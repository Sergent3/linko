/**
 * Watch Processor — monitoraggio fonti ("Aggiornamenti").
 *
 * Job sulla coda linko-watch:
 *   tick     ogni minuto: accoda un "check" per ogni fonte scaduta
 *   check    scarica la fonte, estrae gli elementi, applica il filtro, salva i nuovi
 *   preview  analizza una pagina per il wizard (aree suggerite / elementi di un selettore)
 *   cleanup  ogni giorno: elimina elementi letti vecchi e registro controlli
 *
 * Frequenza adattiva: se a un controllo tutti gli elementi trovati sono nuovi,
 * la lista scorre più velocemente dei controlli e si rischia di perdere elementi:
 * l'intervallo corrente si dimezza (minimo 15 min). Se non c'è nulla di nuovo
 * torna gradualmente verso l'intervallo scelto dall'utente.
 */

import { createHash } from 'crypto';
import { Job, Queue } from 'bullmq';
import { prisma } from '../lib/prisma';
import { fetchPage, httpErrorMessage } from '../watch/http';
import { extractItems, suggestAreas, type ExtractedItem, type SuggestedArea } from '../watch/extract';
import { applyFilter, parseFilter } from '../watch/filter';
import { feedCandidates, looksLikeFeed, parseFeed } from '../watch/feed';

export const WATCH_QUEUE = 'linko-watch';

const TICK_BATCH = 100;
const MIN_INTERVAL = 15;
const MAX_FAILS = 5;
const ITEM_RETENTION_DAYS = 90;
const CHECK_RETENTION_DAYS = 30;

export type WatchJobData =
  | { type: 'tick' }
  | { type: 'check'; sourceId: string }
  | { type: 'preview'; url: string; selector?: string }
  | { type: 'cleanup' };

export interface FoundFeed {
  url: string;
  title: string;
  itemCount: number;
  sample: ExtractedItem[];
}

export interface PreviewResult {
  finalUrl: string;
  status: number;
  /** true se l'URL indicato è già un feed. */
  isFeed: boolean;
  feeds: FoundFeed[];
  areas: SuggestedArea[];
  items: ExtractedItem[];
}

/** Elemento candidato, comune a pagine (area) e feed. */
interface Candidate {
  key: string;
  url: string;
  title: string;
  publishedAt?: string;
  tags: string[];
}

// Tempo massimo dedicato alla ricerca dei feed durante il preview del wizard
const FEED_DISCOVERY_BUDGET_MS = 15_000;

function itemKey(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

/** Nuovo intervallo corrente in base all'esito del controllo. */
export function nextInterval(base: number, current: number, found: number, fresh: number, firstCheck: boolean): number {
  if (firstCheck || found === 0) return current;
  if (fresh >= found) return Math.max(MIN_INTERVAL, Math.floor(current / 2));
  if (fresh === 0) return Math.min(base, Math.ceil(current * 1.5));
  return current;
}

// ── tick ──────────────────────────────────────────────────────────────────────

async function tick(queue: Queue): Promise<number> {
  const now = new Date();
  const due = await prisma.watchSource.findMany({
    where: { isActive: true, nextCheckAt: { lte: now } },
    select: { id: true, currentIntervalMinutes: true },
    orderBy: { nextCheckAt: 'asc' },
    take: TICK_BATCH,
  });
  if (due.length === 0) return 0;

  // Sposta subito nextCheckAt: il prossimo tick non deve riaccodarle
  await prisma.$transaction(
    due.map((s) =>
      prisma.watchSource.update({ where: { id: s.id }, data: { nextCheckAt: addMinutes(now, s.currentIntervalMinutes) } }),
    ),
  );
  const slot = Math.floor(now.getTime() / 60_000);
  await queue.addBulk(
    due.map((s) => ({
      name: 'check',
      data: { type: 'check' as const, sourceId: s.id },
      opts: { jobId: `check-${s.id}-${slot}`, removeOnComplete: true, removeOnFail: 100 },
    })),
  );
  return due.length;
}

// ── check ─────────────────────────────────────────────────────────────────────

/** Scarica la fonte e restituisce gli elementi candidati, prima del filtro. */
async function collect(source: { mode: string; url: string; selector: string | null; feedUrl: string | null }): Promise<Candidate[]> {
  if (source.mode === 'FEED') {
    if (!source.feedUrl) throw new Error('Fonte feed senza URL del feed');
    const res = await fetchPage(source.feedUrl);
    if (res.status >= 400) throw new Error(httpErrorMessage(res.status, 'Il feed'));
    const feed = parseFeed(res.html, res.url);
    if (!feed) throw new Error('L\'indirizzo non restituisce più un feed RSS/Atom');
    // Chiave dal guid/id del feed: resta stabile anche se cambia l'URL dell'articolo
    return feed.items.map((i) => ({ ...i, key: itemKey(i.key) }));
  }

  if (!source.selector) throw new Error('Fonte senza area selezionata');
  const page = await fetchPage(source.url);
  if (page.status >= 400) throw new Error(httpErrorMessage(page.status));
  const found = extractItems(page.html, page.url, source.selector);
  if (found.length === 0) throw new Error('Nessun elemento trovato nell\'area: la pagina potrebbe essere cambiata');
  return found.map((i) => ({ ...i, key: itemKey(i.url), tags: [] }));
}

async function check(sourceId: string): Promise<void> {
  const source = await prisma.watchSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.isActive) return;

  const started = Date.now();
  const firstCheck = source.lastCheckedAt === null;
  try {
    const found = await collect(source);

    const terms = parseFilter(source.filter);
    const matching = found
      .map((item) => ({ item, result: applyFilter(terms, { title: item.title, tags: item.tags }) }))
      .filter((x) => x.result.matched);

    const keys = matching.map((x) => x.item.key);
    const existing = new Set(
      (await prisma.watchItem.findMany({ where: { sourceId, key: { in: keys } }, select: { key: true } })).map((i) => i.key),
    );
    const fresh = matching.filter((x) => !existing.has(x.item.key));
    const now = new Date();

    await prisma.$transaction([
      prisma.watchItem.createMany({
        data: fresh.map(({ item, result }) => ({
          sourceId,
          userId: source.userId,
          key: item.key,
          url: item.url,
          title: item.title,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          matchedTerms: result.matchedTerms,
          // Al primo controllo di un sito, ciò che c'è già è lo stato di partenza, non una novità
          isRead: firstCheck && source.kind === 'SITE',
        })),
        skipDuplicates: true,
      }),
      prisma.watchItem.updateMany({ where: { sourceId, key: { in: [...existing] } }, data: { lastSeenAt: now } }),
      prisma.watchSource.update({
        where: { id: sourceId },
        data: {
          status: 'OK',
          lastError: null,
          failCount: 0,
          lastCheckedAt: now,
          currentIntervalMinutes: nextInterval(
            source.intervalMinutes, source.currentIntervalMinutes, matching.length, fresh.length, firstCheck,
          ),
        },
      }),
      prisma.watchCheck.create({
        data: { sourceId, durationMs: Date.now() - started, ok: true, itemsFound: found.length, newItems: fresh.length },
      }),
    ]);
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    const failCount = source.failCount + 1;
    await prisma.$transaction([
      prisma.watchSource.update({
        where: { id: sourceId },
        data: {
          status: 'ERROR',
          lastError: message,
          failCount,
          lastCheckedAt: new Date(),
          // Dopo troppi errori consecutivi la fonte si sospende: la riattiva l'utente
          ...(failCount >= MAX_FAILS && { isActive: false }),
        },
      }),
      prisma.watchCheck.create({ data: { sourceId, durationMs: Date.now() - started, ok: false, error: message } }),
    ]);
  }
}

// ── preview ───────────────────────────────────────────────────────────────────

async function preview(url: string, selector?: string): Promise<PreviewResult> {
  const page = await fetchPage(url);
  if (page.status >= 400) throw new Error(httpErrorMessage(page.status));

  // L'utente ha incollato direttamente un feed
  const direct = parseFeed(page.html, page.url);
  if (direct) {
    return {
      finalUrl: page.url, status: page.status, isFeed: true, areas: [], items: [],
      feeds: [{ url: page.url, title: direct.title, itemCount: direct.items.length, sample: direct.items.slice(0, 5) }],
    };
  }

  if (selector) {
    return {
      finalUrl: page.url, status: page.status, isFeed: false, feeds: [], areas: [],
      items: extractItems(page.html, page.url, selector).slice(0, 50),
    };
  }

  return {
    finalUrl: page.url,
    status: page.status,
    isFeed: false,
    feeds: await discoverFeeds(page.html, page.url),
    areas: suggestAreas(page.html, page.url),
    items: [],
  };
}

/** Prova i feed dichiarati e i percorsi comuni, entro un tempo massimo. */
async function discoverFeeds(html: string, pageUrl: string): Promise<FoundFeed[]> {
  const deadline = Date.now() + FEED_DISCOVERY_BUDGET_MS;
  const found: FoundFeed[] = [];
  for (const candidate of feedCandidates(html, pageUrl)) {
    if (Date.now() > deadline || found.length >= 3) break;
    try {
      const res = await fetchPage(candidate);
      if (res.status >= 400 || !looksLikeFeed(res.html)) continue;
      const feed = parseFeed(res.html, res.url);
      if (!feed || feed.items.length === 0 || found.some((f) => f.url === res.url)) continue;
      found.push({ url: res.url, title: feed.title, itemCount: feed.items.length, sample: feed.items.slice(0, 5) });
    } catch {
      // Candidato non raggiungibile: si passa al successivo
    }
  }
  return found;
}

// ── cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const now = Date.now();
  await prisma.watchItem.deleteMany({
    where: {
      isRead: true,
      savedBookmarkId: null,
      firstSeenAt: { lt: new Date(now - ITEM_RETENTION_DAYS * 86_400_000) },
    },
  });
  await prisma.watchCheck.deleteMany({
    where: { startedAt: { lt: new Date(now - CHECK_RETENTION_DAYS * 86_400_000) } },
  });
}

// ── entry point ───────────────────────────────────────────────────────────────

export function createWatchProcessor(queue: Queue) {
  return async function watchProcessor(job: Job<WatchJobData>): Promise<unknown> {
    switch (job.data.type) {
      case 'tick':
        return tick(queue);
      case 'check':
        return check(job.data.sourceId);
      case 'preview':
        return preview(job.data.url, job.data.selector);
      case 'cleanup':
        return cleanup();
    }
  };
}
