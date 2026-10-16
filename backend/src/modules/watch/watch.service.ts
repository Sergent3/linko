import { prisma } from '../../lib/prisma';
import { watchQueue, watchQueueEvents } from '../../lib/queue';
import { normalizeAndHash } from '../../utils/url-hash';
import { AppError } from '../../middleware/error.middleware';
import { createBookmark } from '../bookmarks/bookmarks.service';
import { config } from '../../config';
import { encrypt, loadKey } from '../../utils/secret-box';
import { cleanUserAgent, CookieInputError, domainOf, parseCookieInput } from './cookies';
import { sanitizeContent } from './content';
import { forgetFailures } from '../extension/extension.service';
import type { CreateDomainMoveDto, CreateSourceDto, ListItemsDto, PreviewDto, ReadAllDto, SaveCredentialDto, UpdateItemDto, UpdateSourceDto } from './watch.schema';

const PREVIEW_TIMEOUT_MS = 30_000;

async function assertSource(id: string, userId: string) {
  const source = await prisma.watchSource.findFirst({ where: { id, userId } });
  if (!source) throw new AppError(404, 'Fonte non trovata');
  return source;
}

async function assertItem(id: string, userId: string) {
  const item = await prisma.watchItem.findFirst({ where: { id, userId } });
  if (!item) throw new AppError(404, 'Elemento non trovato');
  return item;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview (wizard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analizza una pagina tramite il worker: aree suggerite, oppure elementi
 * estratti con il selettore indicato. Il backend non scarica mai pagine esterne.
 */
export async function preview(dto: PreviewDto, userId: string) {
  const job = await watchQueue.add(
    'preview',
    { type: 'preview', url: dto.url, selector: dto.selector, userId, page: dto.page },
    // I job vanno conservati qualche secondo: se spariscono subito,
    // waitUntilFinished può non ricevere l'evento di completamento
    { removeOnComplete: { age: 60 }, removeOnFail: { age: 60 }, attempts: 1 },
  );
  try {
    return await job.waitUntilFinished(watchQueueEvents, PREVIEW_TIMEOUT_MS);
  } catch (err) {
    const msg = (err as Error).message;
    if (/timed out/i.test(msg)) throw new AppError(504, 'La pagina non ha risposto in tempo');
    throw new AppError(422, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonti
// ─────────────────────────────────────────────────────────────────────────────

export async function listSources(userId: string) {
  const sources = await prisma.watchSource.findMany({
    where: { userId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const unread = await prisma.watchItem.groupBy({
    by: ['sourceId'],
    where: { userId, isRead: false, isHidden: false },
    _count: { _all: true },
  });
  const counts = new Map(unread.map((u) => [u.sourceId, u._count._all]));
  return sources.map((s) => ({ ...s, unreadCount: counts.get(s.id) ?? 0 }));
}

export async function createSource(dto: CreateSourceDto, userId: string) {
  if (dto.bookmarkId) {
    const bm = await prisma.bookmark.findFirst({ where: { id: dto.bookmarkId, userId, deletedAt: null } });
    if (!bm) throw new AppError(404, 'Segnalibro non trovato');
  }
  // Le nuove fonti vanno in fondo all'ordine personalizzato
  const last = await prisma.watchSource.aggregate({ where: { userId }, _max: { position: true } });
  return prisma.watchSource.create({
    data: {
      userId,
      position: (last._max.position ?? -1) + 1,
      category: dto.category ?? null,
      delivery: dto.delivery,
      fetcher: dto.fetcher,
      name: dto.name,
      url: dto.url,
      kind: dto.kind,
      mode: dto.thread ? 'THREAD' : dto.feedUrl ? 'FEED' : 'AREA',
      selector: dto.selector,
      feedUrl: dto.feedUrl,
      filter: dto.filter,
      intervalMinutes: dto.intervalMinutes,
      currentIntervalMinutes: dto.intervalMinutes,
      bookmarkId: dto.bookmarkId,
    },
  });
}

export async function updateSource(id: string, dto: UpdateSourceDto, userId: string) {
  const source = await assertSource(id, userId);
  const reactivated = dto.isActive === true && !source.isActive;
  const { thread, ...fields } = dto;

  // Nuovo bersaglio (pagina, area, feed o discussione)
  const target = thread
    ? { mode: 'THREAD' as const, selector: null, feedUrl: null }
    : dto.feedUrl
      ? { mode: 'FEED' as const, selector: null, feedUrl: dto.feedUrl }
      : dto.selector
        ? { mode: 'AREA' as const, selector: dto.selector, feedUrl: null }
        : null;
  const retargeted =
    (dto.url !== undefined && dto.url !== source.url) ||
    (target !== null && (target.mode !== source.mode || target.selector !== source.selector || target.feedUrl !== source.feedUrl));
  // Cambiare bersaglio o filtro equivale a ripartire: si ricontrolla subito
  const reconfigured = retargeted
    || (dto.filter !== undefined && dto.filter !== source.filter)
    || (dto.fetcher !== undefined && dto.fetcher !== source.fetcher);

  return prisma.watchSource.update({
    where: { id },
    data: {
      ...fields,
      ...target,
      ...(dto.intervalMinutes !== undefined && { currentIntervalMinutes: dto.intervalMinutes }),
      // Con un bersaglio nuovo il prossimo controllo fa da punto di partenza: ciò che c'è già non è una novità
      ...(retargeted && { lastCheckedAt: null, status: 'PENDING' as const }),
      ...((reactivated || reconfigured) && { failCount: 0, lastError: null, nextCheckAt: new Date() }),
    },
  });
}

/** Salva l'ordine personalizzato: gli id non elencati finiscono in coda, nel loro ordine attuale. */
export async function reorderSources(ids: string[], userId: string) {
  const sources = await prisma.watchSource.findMany({
    where: { userId },
    select: { id: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const own = new Set(sources.map((s) => s.id));
  const listed = [...new Set(ids.filter((id) => own.has(id)))];
  const rest = sources.map((s) => s.id).filter((id) => !listed.includes(id));
  const order = [...listed, ...rest];
  await prisma.$transaction(order.map((id, position) => prisma.watchSource.update({ where: { id }, data: { position } })));
  return listSources(userId);
}

/** Rinomina una categoria su tutte le fonti dell'utente; con "to" null la toglie. */
export async function renameCategory(from: string, to: string | null, userId: string) {
  const { count } = await prisma.watchSource.updateMany({ where: { userId, category: from }, data: { category: to } });
  return { updated: count };
}

export async function deleteSource(id: string, userId: string) {
  await assertSource(id, userId);
  await prisma.watchSource.delete({ where: { id } });
}

/** Chiede un controllo al prossimo tick (entro un minuto). */
export async function checkNow(id: string, userId: string) {
  await assertSource(id, userId);
  return prisma.watchSource.update({ where: { id }, data: { nextCheckAt: new Date() } });
}

/**
 * Sincronizza ora tutte le fonti attive: quelle del server vanno subito in coda al worker
 * (stesso jobId del tick, che così non le ripete), quelle dell'estensione tornano
 * disponibili ai browser collegati, che le prendono alla prossima richiesta (entro un minuto).
 */
export async function syncAll(userId: string) {
  const now = new Date();
  const sources = await prisma.watchSource.findMany({
    where: { userId, isActive: true },
    select: { id: true, fetcher: true, currentIntervalMinutes: true },
  });
  const server = sources.filter((s) => s.fetcher === 'SERVER');
  const browser = sources.filter((s) => s.fetcher === 'EXTENSION');
  await prisma.$transaction([
    ...server.map((s) =>
      prisma.watchSource.update({ where: { id: s.id }, data: { nextCheckAt: new Date(now.getTime() + s.currentIntervalMinutes * 60_000) } }),
    ),
    ...(browser.length ? [prisma.watchSource.updateMany({ where: { id: { in: browser.map((s) => s.id) } }, data: { nextCheckAt: now } })] : []),
  ]);
  const slot = Math.floor(now.getTime() / 60_000);
  if (server.length) {
    await watchQueue.addBulk(
      server.map((s) => ({
        name: 'check',
        data: { type: 'check' as const, sourceId: s.id },
        opts: { jobId: `check-${s.id}-${slot}`, removeOnComplete: true, removeOnFail: 100 },
      })),
    );
  }
  // Ogni browser collegato riprova anche le fonti dove aveva trovato la verifica anti-bot
  forgetFailures(browser.map((s) => s.id));
  return { server: server.length, browser: browser.length };
}

export async function listChecks(id: string, userId: string) {
  await assertSource(id, userId);
  return prisma.watchCheck.findMany({ where: { sourceId: id }, orderBy: { startedAt: 'desc' }, take: 20 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Elementi
// ─────────────────────────────────────────────────────────────────────────────

/** Fonti selezionate da un filtro di elenco: una fonte, un sito o una categoria ("-" = senza categoria). */
async function scopeFor(userId: string, f: { sourceId?: string; domain?: string; category?: string }) {
  if (f.sourceId) return { sourceId: f.sourceId };
  if (f.domain) return { sourceId: { in: await sourceIdsForDomain(userId, f.domain) } };
  if (f.category) {
    const sources = await prisma.watchSource.findMany({
      where: { userId, category: f.category === '-' ? null : f.category },
      select: { id: true },
    });
    return { sourceId: { in: sources.map((s) => s.id) } };
  }
  return {};
}

/** Id delle fonti dell'utente che appartengono al sito (host senza www). */
async function sourceIdsForDomain(userId: string, domain: string): Promise<string[]> {
  const target = domain.toLowerCase().replace(/^www\./, '');
  const sources = await prisma.watchSource.findMany({ where: { userId }, select: { id: true, url: true } });
  return sources.filter((s) => hostOf(s.url) === target).map((s) => s.id);
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

export async function listItems(dto: ListItemsDto, userId: string) {
  const where = {
    userId,
    isHidden: false,
    ...(await scopeFor(userId, dto)),
    ...(dto.unread !== undefined && { isRead: !dto.unread }),
  };
  const [data, total] = await Promise.all([
    prisma.watchItem.findMany({
      where,
      orderBy: { firstSeenAt: 'desc' },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: { source: { select: { id: true, name: true, kind: true, mode: true, delivery: true } } },
    }),
    prisma.watchItem.count({ where }),
  ]);
  return { data, meta: { page: dto.page, limit: dto.limit, total, totalPages: Math.ceil(total / dto.limit) } };
}

/** Un elemento dell'utente (per il viewer remoto, che apre il suo indirizzo). */
export async function getItem(id: string, userId: string) {
  const item = await assertItem(id, userId);
  return { id: item.id, url: item.url, title: item.title, sourceId: item.sourceId };
}

export async function updateItem(id: string, dto: UpdateItemDto, userId: string) {
  await assertItem(id, userId);
  return prisma.watchItem.update({ where: { id }, data: dto });
}

export async function markAllRead(userId: string, filter: ReadAllDto = {}) {
  const scope = await scopeFor(userId, filter);
  const { count } = await prisma.watchItem.updateMany({
    where: { userId, isRead: false, ...scope },
    data: { isRead: true },
  });
  return { updated: count };
}

/**
 * Contenuto dell'elemento da leggere senza lasciare Linko: il worker scarica la
 * pagina (con i cookie del sito) ed estrae il post o l'articolo; qui viene
 * ripulito prima di arrivare al browser.
 */
export async function itemContent(id: string, userId: string) {
  const item = await assertItem(id, userId);
  const job = await watchQueue.add(
    'content',
    { type: 'content', url: item.url, userId },
    { removeOnComplete: { age: 60 }, removeOnFail: { age: 60 }, attempts: 1 },
  );
  let raw: { url: string; title: string; author?: string; publishedAt?: string; image?: string; html: string };
  try {
    raw = await job.waitUntilFinished(watchQueueEvents, PREVIEW_TIMEOUT_MS);
  } catch (err) {
    const msg = (err as Error).message;
    if (/timed out/i.test(msg)) throw new AppError(504, 'La pagina non ha risposto in tempo');
    throw new AppError(422, msg);
  }
  return { ...raw, html: sanitizeContent(raw.html, raw.url) };
}

/** Salva l'elemento come segnalibro; se l'URL è già tra i segnalibri, lo collega. */
export async function saveAsBookmark(id: string, userId: string) {
  const item = await assertItem(id, userId);
  let bookmarkId: string;
  try {
    const bm = await createBookmark({ url: item.url, title: item.title, tags: [] }, userId);
    bookmarkId = bm.id;
  } catch (err) {
    if (!(err instanceof AppError) || err.statusCode !== 409) throw err;
    const { hash } = normalizeAndHash(item.url);
    const existing = await prisma.bookmark.findUnique({ where: { urlHash_userId: { urlHash: hash, userId } } });
    if (!existing) throw err;
    bookmarkId = existing.id;
  }
  return prisma.watchItem.update({ where: { id }, data: { savedBookmarkId: bookmarkId, isRead: true } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Accessi ai siti (cookie di sessione cifrati)
// ─────────────────────────────────────────────────────────────────────────────

const secretKey = loadKey(config.WATCH_SECRET_KEY);

/** Campi mostrabili: il cookie non esce mai dal server. */
const credentialSelect = {
  id: true, domain: true, cookieNames: true, userAgent: true, status: true, lastError: true,
  lastUsedAt: true, lastStatus: true, expiredAt: true, createdAt: true, updatedAt: true,
} as const;

export async function listCredentials(userId: string) {
  const creds = await prisma.siteCredential.findMany({ where: { userId }, select: credentialSelect, orderBy: { domain: 'asc' } });
  // Fonti che usano ciascun accesso (stesso dominio o sottodominio)
  const sources = await prisma.watchSource.findMany({ where: { userId }, select: { url: true, feedUrl: true } });
  return creds.map((c) => ({
    ...c,
    hasUserAgent: !!c.userAgent,
    userAgent: undefined,
    sourceCount: sources.filter((s) => [s.url, s.feedUrl].some((u) => u && hostMatches(u, c.domain))).length,
  }));
}

function hostMatches(url: string, domain: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === domain || h.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/** Le fonti del dominio ferme per accesso scaduto ripartono subito. */
async function resumeSources(userId: string, domain: string) {
  const sources = await prisma.watchSource.findMany({ where: { userId }, select: { id: true, url: true, feedUrl: true } });
  const ids = sources.filter((s) => [s.url, s.feedUrl].some((u) => u && hostMatches(u, domain))).map((s) => s.id);
  if (ids.length === 0) return;
  await prisma.watchSource.updateMany({
    where: { id: { in: ids } },
    data: { isActive: true, status: 'PENDING', lastError: null, failCount: 0, nextCheckAt: new Date() },
  });
}

export async function saveCredential(dto: SaveCredentialDto, userId: string) {
  let domain: string;
  let parsed: { header: string; names: string[] };
  let userAgent: string | null;
  try {
    domain = domainOf(dto.site);
    parsed = parseCookieInput(dto.cookie, domain);
    userAgent = cleanUserAgent(dto.userAgent);
  } catch (err) {
    if (err instanceof CookieInputError) throw new AppError(400, err.message);
    throw err;
  }
  const data = {
    cookieEnc: encrypt(parsed.header, secretKey),
    cookieNames: parsed.names,
    userAgent,
    status: 'UNVERIFIED' as const,
    lastError: null,
    lastStatus: null,
    expiredAt: null,
  };
  const cred = await prisma.siteCredential.upsert({
    where: { userId_domain: { userId, domain } },
    create: { userId, domain, ...data },
    update: data,
    select: { id: true },
  });
  await resumeSources(userId, domain);
  const verification = await verifyCredential(cred.id, userId, dto.testUrl);
  return { credential: (await listCredentials(userId)).find((c) => c.id === cred.id), verification };
}

export async function verifyCredential(id: string, userId: string, testUrl?: string) {
  const cred = await prisma.siteCredential.findFirst({ where: { id, userId }, select: { id: true, domain: true } });
  if (!cred) throw new AppError(404, 'Accesso non trovato');
  const url = testUrl && hostMatches(testUrl, cred.domain) ? testUrl : `https://${cred.domain}/`;
  const job = await watchQueue.add(
    'verify',
    { type: 'verify', userId, credentialId: cred.id, url },
    { removeOnComplete: { age: 60 }, removeOnFail: { age: 60 }, attempts: 1 },
  );
  try {
    return await job.waitUntilFinished(watchQueueEvents, PREVIEW_TIMEOUT_MS);
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false, message: /timed out/i.test(msg) ? 'Il sito non ha risposto in tempo' : msg };
  }
}

export async function deleteCredential(id: string, userId: string) {
  const cred = await prisma.siteCredential.findFirst({ where: { id, userId } });
  if (!cred) throw new AppError(404, 'Accesso non trovato');
  await prisma.siteCredential.delete({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cambi di dominio (il worker li rileva da redirect o domini spariti)
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_MOVE_TIMEOUT_MS = 180_000;

function hostOrNull(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostInput(input: string): string {
  try {
    return domainOf(input);
  } catch {
    throw new AppError(400, `Indirizzo non valido: ${input}`);
  }
}

/** Fonti e segnalibri dell'utente sul dominio indicato. */
async function onHost(userId: string, host: string) {
  const like = `%${host}%`;
  const [sources, bookmarks] = await Promise.all([
    prisma.watchSource.findMany({
      where: { userId, OR: [{ url: { contains: host } }, { feedUrl: { contains: host } }] },
      select: { id: true, name: true, url: true, feedUrl: true },
    }),
    prisma.$queryRaw<Array<{ id: string; url: string }>>`
      SELECT id, url FROM "Bookmark" WHERE "userId" = ${userId} AND "deletedAt" IS NULL AND url LIKE ${like}`,
  ]);
  return {
    sources: sources.filter((s) => hostOrNull(s.url) === host || hostOrNull(s.feedUrl) === host),
    bookmarks: bookmarks.filter((b) => hostOrNull(b.url) === host),
  };
}

/** Proposte in attesa, con quante fonti e segnalibri toccano. */
export async function listDomainMoves(userId: string) {
  const moves = await prisma.domainMove.findMany({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  return Promise.all(moves.map(async (m) => {
    const { sources, bookmarks } = await onHost(userId, m.oldHost);
    return { ...m, sources: sources.map((s) => ({ id: s.id, name: s.name })), bookmarkCount: bookmarks.length };
  }));
}

/** Cambio di dominio indicato dall'utente (es. "eurekaddl.living" → "eurekaddl.beer"). */
export async function createDomainMove(dto: CreateDomainMoveDto, userId: string) {
  const oldHost = hostInput(dto.from);
  const newHost = hostInput(dto.to);
  if (oldHost === newHost) throw new AppError(400, 'Il nuovo dominio è uguale a quello vecchio');
  const { sources, bookmarks } = await onHost(userId, oldHost);
  if (sources.length === 0 && bookmarks.length === 0) throw new AppError(404, `Nessuna fonte o segnalibro su ${oldHost}`);
  return prisma.domainMove.upsert({
    where: { userId_oldHost_newHost: { userId, oldHost, newHost } },
    create: { userId, oldHost, newHost, reason: 'MANUAL' },
    update: { status: 'PENDING', resolvedAt: null },
  });
}

/**
 * Applica il cambio: fonti ed elementi li sposta il worker (deve riscaricare le
 * fonti per riallineare le chiavi), i segnalibri il backend (hash dell'URL).
 */
export async function applyDomainMove(id: string, userId: string) {
  const move = await prisma.domainMove.findFirst({ where: { id, userId } });
  if (!move) throw new AppError(404, 'Proposta non trovata');
  if (move.status === 'APPLIED') throw new AppError(409, 'Cambio già applicato');

  const job = await watchQueue.add(
    'domainMove',
    { type: 'domainMove', userId, moveId: id },
    { removeOnComplete: { age: 300 }, removeOnFail: { age: 300 }, attempts: 1 },
  );
  let result: { sources: number; items: number; realigned: number };
  try {
    result = await job.waitUntilFinished(watchQueueEvents, DOMAIN_MOVE_TIMEOUT_MS);
  } catch (err) {
    throw new AppError(422, (err as Error).message);
  }

  // Segnalibri: nuovo URL e nuovo hash; se il nuovo indirizzo è già salvato si lascia com'è
  const { bookmarks } = await onHost(userId, move.oldHost);
  let movedBookmarks = 0;
  for (const b of bookmarks) {
    const u = new URL(b.url);
    u.hostname = move.newHost;
    const { normalized, hash } = normalizeAndHash(u.toString());
    const clash = await prisma.bookmark.findFirst({ where: { userId, urlHash: hash, id: { not: b.id } }, select: { id: true } });
    if (clash) continue;
    await prisma.bookmark.update({ where: { id: b.id }, data: { url: normalized, urlHash: hash } });
    movedBookmarks++;
  }
  return { ...result, bookmarks: movedBookmarks, oldHost: move.oldHost, newHost: move.newHost };
}

export async function dismissDomainMove(id: string, userId: string) {
  const { count } = await prisma.domainMove.updateMany({
    where: { id, userId, status: 'PENDING' },
    data: { status: 'DISMISSED', resolvedAt: new Date() },
  });
  if (!count) throw new AppError(404, 'Proposta non trovata');
}
