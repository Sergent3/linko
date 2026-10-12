import { prisma } from '../../lib/prisma';
import { watchQueue, watchQueueEvents } from '../../lib/queue';
import { normalizeAndHash } from '../../utils/url-hash';
import { AppError } from '../../middleware/error.middleware';
import { createBookmark } from '../bookmarks/bookmarks.service';
import type { CreateSourceDto, ListItemsDto, PreviewDto, UpdateItemDto, UpdateSourceDto } from './watch.schema';

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
export async function preview(dto: PreviewDto) {
  const job = await watchQueue.add(
    'preview',
    { type: 'preview', url: dto.url, selector: dto.selector },
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
    orderBy: { createdAt: 'asc' },
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
  return prisma.watchSource.create({
    data: {
      userId,
      name: dto.name,
      url: dto.url,
      kind: 'SITE',
      mode: 'AREA',
      selector: dto.selector,
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
  // Cambiare area o filtro equivale a ripartire: si ricontrolla subito
  const reconfigured = dto.selector !== undefined || dto.filter !== undefined;
  return prisma.watchSource.update({
    where: { id },
    data: {
      ...dto,
      ...(dto.intervalMinutes !== undefined && { currentIntervalMinutes: dto.intervalMinutes }),
      ...((reactivated || reconfigured) && { failCount: 0, lastError: null, nextCheckAt: new Date() }),
    },
  });
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

export async function listChecks(id: string, userId: string) {
  await assertSource(id, userId);
  return prisma.watchCheck.findMany({ where: { sourceId: id }, orderBy: { startedAt: 'desc' }, take: 20 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Elementi
// ─────────────────────────────────────────────────────────────────────────────

export async function listItems(dto: ListItemsDto, userId: string) {
  const where = {
    userId,
    isHidden: false,
    ...(dto.sourceId && { sourceId: dto.sourceId }),
    ...(dto.unread !== undefined && { isRead: !dto.unread }),
  };
  const [data, total] = await Promise.all([
    prisma.watchItem.findMany({
      where,
      orderBy: { firstSeenAt: 'desc' },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: { source: { select: { id: true, name: true, kind: true } } },
    }),
    prisma.watchItem.count({ where }),
  ]);
  return { data, meta: { page: dto.page, limit: dto.limit, total, totalPages: Math.ceil(total / dto.limit) } };
}

export async function updateItem(id: string, dto: UpdateItemDto, userId: string) {
  await assertItem(id, userId);
  return prisma.watchItem.update({ where: { id }, data: dto });
}

export async function markAllRead(userId: string, sourceId?: string) {
  const { count } = await prisma.watchItem.updateMany({
    where: { userId, isRead: false, ...(sourceId && { sourceId }) },
    data: { isRead: true },
  });
  return { updated: count };
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
