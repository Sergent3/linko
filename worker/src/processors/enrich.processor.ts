/**
 * Enrich Processor
 *
 * Scarica la pagina web e ne estrae i metadati OpenGraph:
 *   og:title, og:description, og:image
 * con fallback su <meta name="description"> e <title>.
 *
 * Resilienza:
 * - User-Agent realistico per evitare blocchi naïf
 * - Timeout configurabile
 * - Ritardo tra richieste (rate limiting configurato nel Worker)
 * - Non lancia eccezione per status 4xx/5xx: li registra e termina
 * - Lancia eccezione per errori di rete → BullMQ eseguirà retry exponential
 */

import { Job } from 'bullmq';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export interface EnrichJobData {
  bookmarkId: string;
  url: string;
}

// Header che simulano un browser reale per evitare blocchi semplici
const SCRAPING_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

function extractMeta($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const content = $(sel).attr('content')?.trim();
    if (content) return content;
  }
}

function validateImageUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function enrichProcessor(job: Job<EnrichJobData>): Promise<void> {
  const { bookmarkId, url } = job.data;

  await prisma.bookmark.update({
    where: { id: bookmarkId },
    data: { enrichStatus: 'PROCESSING' },
  });

  try {
    const response = await axios.get<string>(url, {
      headers: SCRAPING_HEADERS,
      timeout: config.SCRAPING_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true, // Non lanciare mai su 4xx/5xx
      responseType: 'text',
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
    );

    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(imageUrl && { imageUrl }),
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
