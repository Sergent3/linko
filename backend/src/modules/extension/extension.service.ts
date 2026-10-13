/**
 * Estensione del browser: controlla dal computer dell'utente le fonti che il
 * server non può scaricare (verifiche anti-bot come Cloudflare Turnstile).
 *
 *   1. l'utente collega l'estensione da Linko: riceve un token (qui solo l'hash)
 *   2. ogni minuto l'estensione chiede le fonti scadute (jobs) e le "prenota"
 *   3. apre le pagine nel browser e manda l'HTML (results)
 *   4. il worker le elabora come i controlli normali (job check con page)
 */
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { watchQueue } from '../../lib/queue';
import { AppError } from '../../middleware/error.middleware';
import type { AgentResultDto } from './extension.schema';

const TOKEN_PREFIX = 'lkx_';
// Fonti consegnate a ogni richiesta: l'estensione le apre una alla volta
const JOBS_PER_POLL = 5;
// Ogni quanto l'estensione torna a chiedere (secondi)
export const POLL_SECONDS = 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Stessa regola di worker/src/watch/thread.ts: per un thread si scarica l'ultima pagina
const THREAD_RE = /^(https?:\/\/[^?#]+?\/threads\/(?:[^/?#]*\.)?\d+)(?:[/?#]|$)/i;

/** Pagina che l'estensione deve aprire per controllare la fonte. */
export function targetUrl(source: { mode: string; url: string; feedUrl: string | null }): string {
  if (source.mode === 'FEED' && source.feedUrl) return source.feedUrl;
  if (source.mode === 'THREAD') {
    const base = source.url.match(THREAD_RE)?.[1];
    if (base) return `${base}/latest`;
  }
  return source.url;
}

/** Host (senza www) delle pagine da aprire: l'estensione chiede il permesso per questi siti. */
function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

// ── Collegamento ─────────────────────────────────────────────────────────────

export async function createToken(userId: string) {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const row = await prisma.extensionToken.create({ data: { userId, tokenHash: hashToken(token) } });
  return { id: row.id, token };
}

export async function status(userId: string) {
  const [tokens, sources] = await Promise.all([
    prisma.extensionToken.findMany({
      where: { userId },
      select: { id: true, browser: true, version: true, createdAt: true, lastSeenAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.watchSource.findMany({
      where: { userId, fetcher: 'EXTENSION' },
      select: { id: true, name: true, url: true, isActive: true, status: true, lastError: true, lastCheckedAt: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { tokens, sources, pollSeconds: POLL_SECONDS };
}

export async function revokeToken(id: string, userId: string) {
  const { count } = await prisma.extensionToken.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError(404, 'Collegamento non trovato');
}

/** Utente del token dell'estensione, aggiornando l'ultimo contatto. */
export async function authenticate(token: string, info: { version?: string; browser?: string }) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const row = await prisma.extensionToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row) return null;
  await prisma.extensionToken.update({
    where: { id: row.id },
    data: {
      lastSeenAt: new Date(),
      ...(info.version && { version: info.version.slice(0, 20) }),
      ...(info.browser && { browser: info.browser.slice(0, 80) }),
    },
  });
  return { userId: row.userId, tokenId: row.id };
}

// ── Lavoro dell'estensione ───────────────────────────────────────────────────

/**
 * Fonti da controllare adesso. Vengono prenotate spostando nextCheckAt avanti di
 * un intervallo: se il browser si chiude a metà, tornano disponibili da sole.
 */
export async function jobs(userId: string) {
  const now = new Date();
  const due = await prisma.watchSource.findMany({
    where: { userId, fetcher: 'EXTENSION', isActive: true, nextCheckAt: { lte: now } },
    select: { id: true, name: true, mode: true, url: true, feedUrl: true, currentIntervalMinutes: true },
    orderBy: { nextCheckAt: 'asc' },
    take: JOBS_PER_POLL,
  });
  if (due.length > 0) {
    await prisma.$transaction(
      due.map((s) =>
        prisma.watchSource.update({
          where: { id: s.id },
          data: { nextCheckAt: new Date(now.getTime() + s.currentIntervalMinutes * 60_000) },
        }),
      ),
    );
  }
  // Tutti i siti delle fonti dell'estensione: servono i permessi anche per quelli non ancora scaduti
  const all = await prisma.watchSource.findMany({
    where: { userId, fetcher: 'EXTENSION', isActive: true },
    select: { mode: true, url: true, feedUrl: true },
  });
  const origins = [...new Set(all.map((s) => originOf(targetUrl(s))).filter((o): o is string => !!o))];
  return {
    pollSeconds: POLL_SECONDS,
    origins,
    jobs: due.map((s) => ({ sourceId: s.id, name: s.name, url: targetUrl(s) })),
  };
}

const ERROR_MESSAGES: Record<NonNullable<AgentResultDto['error']>, string> = {
  challenge: 'Il sito chiede la verifica anti-bot anche nel tuo browser: apri il sito, supera la verifica e l\'estensione riprenderà da sola',
  permission: 'L\'estensione non ha il permesso di aprire questo sito: apri l\'estensione e premi «Consenti»',
  network: 'L\'estensione non è riuscita ad aprire la pagina',
};

export async function result(userId: string, dto: AgentResultDto) {
  const source = await prisma.watchSource.findFirst({ where: { id: dto.sourceId, userId, fetcher: 'EXTENSION' } });
  if (!source) throw new AppError(404, 'Fonte non trovata');

  if (dto.page) {
    // Il worker la elabora come un controllo normale, senza contattare il sito
    await watchQueue.add(
      'check',
      { type: 'check', sourceId: source.id, page: dto.page },
      { removeOnComplete: true, removeOnFail: 20 },
    );
    return { queued: true };
  }

  // Errore lato browser: non conta per la sospensione automatica, serve l'utente
  const base = ERROR_MESSAGES[dto.error!];
  const message = dto.error === 'network' && dto.message ? `${base}: ${dto.message}` : base;
  await prisma.$transaction([
    prisma.watchSource.update({
      where: { id: source.id },
      data: { status: 'ERROR', lastError: message.slice(0, 500), lastCheckedAt: new Date() },
    }),
    prisma.watchCheck.create({ data: { sourceId: source.id, durationMs: 0, ok: false, error: message.slice(0, 500) } }),
  ]);
  return { queued: false };
}
