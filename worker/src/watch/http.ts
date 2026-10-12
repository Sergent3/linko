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

/** Messaggio comprensibile per un codice HTTP di errore (mostrato nel wizard e nella fonte). */
export function httpErrorMessage(status: number, what = 'La pagina'): string {
  if (status === 401 || status === 403) {
    return `${what} blocca l'accesso automatico (HTTP ${status}): di solito è una protezione anti-bot o serve il login`;
  }
  if (status === 404 || status === 410) return `${what} non esiste (HTTP ${status}): controlla l'indirizzo`;
  if (status === 429) return `Il sito sta limitando le richieste (HTTP 429): riprova tra qualche minuto`;
  if (status >= 500) return `Il sito ha un problema temporaneo (HTTP ${status}): riprova più tardi`;
  return `${what} risponde HTTP ${status}`;
}

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
  /** Accesso (cookie) usato per l'ultima richiesta, se il dominio ne aveva uno */
  authId?: string;
}

/** Cookie di sessione di un sito, già decifrato. */
export interface SiteAuth {
  id: string;
  domain: string;
  cookie: string;
  userAgent: string | null;
}

/** Il cookie di "esempio.it" vale per esempio.it e i suoi sottodomini, mai per altri siti. */
export function authFor(host: string, auths: SiteAuth[]): SiteAuth | undefined {
  const h = host.toLowerCase().replace(/\.$/, '');
  return auths.find((a) => h === a.domain || h.endsWith(`.${a.domain}`));
}

function parseCookieHeader(header: string): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return jar;
}

/** Charset dichiarato: header Content-Type, poi prologo XML o <meta> nei primi 2 KB. */
export function detectCharset(body: Buffer, contentType: string): string {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = body.subarray(0, 2048).toString('latin1');
  const declared = head.match(/<\?xml[^>]*encoding=["']([\w-]+)/i)?.[1]
    ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return (declared ?? 'utf-8').toLowerCase();
}

/** Testo della risposta nella codifica giusta (es. windows-1251 dei siti russi); utf-8 se sconosciuta. */
export function decodeBody(body: Buffer, contentType: string): string {
  try {
    return new TextDecoder(detectCharset(body, contentType)).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

// Domini che di recente hanno chiesto la verifica anti-bot: si va subito col browser
const BROWSER_MEMORY_MS = 6 * 3_600_000;
const needsBrowser = new Map<string, number>();

function rememberedBrowser(host: string): boolean {
  const until = needsBrowser.get(host);
  if (!until) return false;
  if (until < Date.now()) { needsBrowser.delete(host); return false; }
  return true;
}

/**
 * GET con redirect seguiti a mano, controllando ogni hop.
 * Se il dominio di un hop ha un accesso salvato, invia il suo cookie (e User-Agent);
 * i cookie ricevuti durante la catena di redirect valgono per gli hop successivi.
 * Se il sito risponde con una verifica anti-bot, la pagina viene aperta nel
 * browser di riserva (browser.ts), quando è configurato.
 */
export async function fetchPage(rawUrl: string, auths: SiteAuth[] = []): Promise<FetchedPage> {
  const jars = new Map<string, Map<string, string>>();
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    if (rememberedBrowser(url.hostname)) {
      const { browserAvailable, fetchWithBrowser } = await import('./browser');
      if (browserAvailable()) return fetchWithBrowser(url.toString(), auths);
    }
    const auth = authFor(url.hostname, auths);
    let jar: Map<string, string> | undefined;
    if (auth) {
      jar = jars.get(auth.id) ?? parseCookieHeader(auth.cookie);
      jars.set(auth.id, jar);
    }
    const headers: Record<string, string> = { ...SCRAPING_HEADERS };
    if (auth && jar) {
      headers.Cookie = [...jar].map(([n, v]) => `${n}=${v}`).join('; ');
      if (auth.userAgent) headers['User-Agent'] = auth.userAgent;
    }
    const res = await axios.get<ArrayBuffer>(url.toString(), {
      headers,
      timeout: config.SCRAPING_TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: MAX_BYTES,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
    const setCookie = res.headers['set-cookie'];
    if (jar && Array.isArray(setCookie)) {
      for (const c of setCookie) {
        const first = c.split(';')[0];
        const i = first.indexOf('=');
        if (i > 0) jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
      }
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, url).toString();
      continue;
    }
    const html = decodeBody(Buffer.from(res.data ?? new ArrayBuffer(0)), String(res.headers['content-type'] ?? ''));
    if (res.status >= 400) {
      const { browserAvailable, fetchWithBrowser, isChallenge } = await import('./browser');
      if (browserAvailable() && isChallenge(res.status, res.headers as Record<string, unknown>, html)) {
        needsBrowser.set(url.hostname, Date.now() + BROWSER_MEMORY_MS);
        return fetchWithBrowser(url.toString(), auths);
      }
    }
    return { url: url.toString(), status: res.status, html, authId: auth?.id };
  }
  throw new Error(`Troppi redirect (>${MAX_REDIRECTS})`);
}
