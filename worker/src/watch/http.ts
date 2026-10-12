/**
 * Download pagine per il monitoraggio fonti.
 *
 * Protezione SSRF: gli URL sono scelti dall'utente, quindi ogni hop (anche i
 * redirect) viene risolto via DNS e rifiutato se punta a indirizzi interni:
 * loopback, reti private, link-local, rete Docker, metadata cloud.
 */

import dns from 'dns/promises';
import net from 'net';
import axios from 'axios';
import { config } from '../config';

export const SCRAPING_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
};

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

/** true se l'indirizzo IP non deve essere raggiungibile dal worker. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) ||           // link-local, metadata cloud
      (a === 172 && b >= 16 && b <= 31) ||  // privata, include le reti Docker
      (a === 192 && b === 168) ||
      a >= 224                              // multicast e riservati
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v); // ULA, link-local, multicast
  }
  return true; // formato sconosciuto: meglio bloccare
}

/** Verifica che l'URL sia http(s) e che tutti gli IP risolti siano pubblici. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError('URL non valido');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new BlockedUrlError('Solo http e https');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host.endsWith('.onion')) throw new BlockedUrlError('Siti .onion non supportati');

  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  const blocked = (ip: string) => isPrivateAddress(ip) || config.WATCH_BLOCKED_IPS.includes(ip);
  if (addresses.length === 0 || addresses.some(blocked)) {
    throw new BlockedUrlError(`Indirizzo non consentito: ${host}`);
  }
  return url;
}

export interface FetchedPage {
  url: string;    // URL finale dopo i redirect
  status: number;
  html: string;
}

/** GET con redirect seguiti a mano, controllando ogni hop. */
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await axios.get<string>(url.toString(), {
      headers: SCRAPING_HEADERS,
      timeout: config.SCRAPING_TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: MAX_BYTES,
      responseType: 'text',
      validateStatus: () => true,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, url).toString();
      continue;
    }
    return { url: url.toString(), status: res.status, html: typeof res.data === 'string' ? res.data : '' };
  }
  throw new Error(`Troppi redirect (>${MAX_REDIRECTS})`);
}
