/**
 * Enrich Processor
 *
 * Scarica la pagina web e ne estrae i metadati OpenGraph:
 *   og:title, og:description, og:image
 * con fallback su <meta name="description"> e <title>.
 *
 * Siti .onion:
 *   Controlla se Tor è in ascolto sulla porta SOCKS5 (127.0.0.1:9050).
 *   Se sì, instrada la richiesta via Tor. Se no, marca FAILED senza retry.
 *
 * Resilienza:
 * - User-Agent realistico per evitare blocchi naïf
 * - Timeout configurabile
 * - Ritardo tra richieste (rate limiting configurato nel Worker)
 * - Non lancia eccezione per status 4xx/5xx: li registra e termina
 * - Lancia eccezione per errori di rete → BullMQ eseguirà retry exponential
 */

import net from 'net';
import { Job } from 'bullmq';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export interface EnrichJobData {
  bookmarkId: string;
  url: string;
}

const TOR_HOST = '127.0.0.1';
const TOR_PORT = 9050;

// Header che simulano un browser reale per evitare blocchi semplici
const SCRAPING_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

function isOnion(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.onion');
  } catch {
    return false;
  }
}

/** Verifica se il proxy SOCKS5 di Tor è raggiungibile aprendo un socket TCP. */
function isTorAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2_000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
    socket.connect(TOR_PORT, TOR_HOST);
  });
}

function extractMeta($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const content = $(sel).attr('content')?.trim();
    if (content) return content;
  }
}

function validateImageUrl(raw: string | undefined, isOnionSite: boolean): string | undefined {
  if (!raw) return undefined;
  // Le immagini .onion non sono servibili ai browser normali — le scartiamo
  if (isOnionSite) return undefined;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function enrichProcessor(job: Job<EnrichJobData>): Promise<void> {
  const { bookmarkId, url } = job.data;
  const onion = isOnion(url);

  await prisma.bookmark.update({
    where: { id: bookmarkId },
    data: { enrichStatus: 'PROCESSING' },
  });

  // Per i siti .onion, verifica prima se Tor è disponibile
  if (onion) {
    const torUp = await isTorAvailable();
    if (!torUp) {
      console.warn(`[enrich] Tor non disponibile — skip .onion ${url}`);
      await prisma.bookmark.update({
        where: { id: bookmarkId },
        data: { enrichStatus: 'FAILED' },
      });
      return; // Nessun throw → BullMQ non farà retry
    }
    console.log(`[enrich] Tor disponibile — arricchimento .onion ${url}`);
  }

  try {
    const agent = onion
      ? new SocksProxyAgent(`socks5h://${TOR_HOST}:${TOR_PORT}`)
      : undefined;

    const response = await axios.get<string>(url, {
      headers: SCRAPING_HEADERS,
      timeout: config.SCRAPING_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true, // Non lanciare mai su 4xx/5xx
      responseType: 'text',
      // socks5h: la risoluzione DNS avviene dentro Tor (necessario per .onion)
      ...(agent && { httpAgent: agent, httpsAgent: agent }),
    });

    // Per redirect o errori HTTP: salva lo status e chiudi senza errore
    if (response.status >= 400) {
      await prisma.bookmark.update({
        where: { id: bookmarkId },
        data: { httpStatus: response.status, enrichStatus: 'DONE', enrichedAt: new Date() },
      });
      return;
    }

    const $ = cheerio.load(response.data);

    const title = extractMeta($, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) || $('title').text().trim() || undefined;

    const description = extractMeta($, [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
    ]);

    const imageUrl = validateImageUrl(
      extractMeta($, ['meta[property="og:image"]', 'meta[name="twitter:image"]']),
      onion,
    );

    // Estrazione testo markdown completo
    let contentMarkdown: string | undefined;
    try {
      // Rimuovi script e stili per una conversione pulita
      $('script, style, noscript, iframe, nav, footer, header').remove();
      const bodyHtml = $('body').html();
      if (bodyHtml) {
        const turndownService = new TurndownService({ headingStyle: 'atx' });
        contentMarkdown = turndownService.turndown(bodyHtml);
      }
    } catch (e) {
      console.warn(`[enrich] Errore estrazione testuale markdown per ${url}`, e);
    }

    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(imageUrl && { imageUrl }),
        ...(contentMarkdown && { contentMarkdown }),
        httpStatus: response.status,
        enrichStatus: 'DONE',
        enrichedAt: new Date(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] Fallito per ${url}:`, message);

    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: { enrichStatus: 'FAILED' },
    });

    throw err; // BullMQ gestirà il retry con backoff exponential
  }
}
