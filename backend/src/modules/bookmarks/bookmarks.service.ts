import { prisma } from '../../lib/prisma';
import { enrichQueue, healthCheckQueue, tagQueue } from '../../lib/queue';
import { normalizeAndHash } from '../../utils/url-hash';
import { getTagsByDomain, mergeTags } from '../../utils/tag-engine';
import { AppError } from '../../middleware/error.middleware';
import type { CreateBookmarkDto, UpdateBookmarkDto, ListBookmarksDto } from './bookmarks.schema';

// ─────────────────────────────────────────────────────────────────────────────
// Helper interni
// ─────────────────────────────────────────────────────────────────────────────

async function assertExists(id: string, userId: string) {
  const bm = await prisma.bookmark.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!bm) throw new AppError(404, 'Bookmark non trovato');
  return bm;
}

async function upsertTags(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  bookmarkId: string,
  userId: string,
  tagNames: string[],
  source: 'MANUAL' | 'REGEX' | 'AI',
) {
  for (const name of tagNames) {
    const tag = await tx.tag.upsert({
      where: { name_userId: { name: name.toLowerCase(), userId } },
      create: { name: name.toLowerCase(), userId, source },
      update: {},
    });
    await tx.bookmarkTag.upsert({
      where: { bookmarkId_tagId: { bookmarkId, tagId: tag.id } },
      create: { bookmarkId, tagId: tag.id, source },
      update: {},
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createBookmark(dto: CreateBookmarkDto, userId: string) {
  const { normalized, hash } = normalizeAndHash(dto.url);

  // De-duplicazione
  const existing = await prisma.bookmark.findUnique({
    where: { urlHash_userId: { urlHash: hash, userId } },
  });

  if (existing) {
    if (existing.deletedAt) {
      // Ripristina un bookmark eliminato con soft-delete
      return prisma.bookmark.update({
        where: { id: existing.id },
        data: { deletedAt: null, enrichStatus: 'PENDING' },
      });
    }
    throw new AppError(409, 'Bookmark già esistente');
  }

  // Tag ibridi: regex (gratuiti) + manuali
  const domainTags = getTagsByDomain(normalized);
  const allTagNames = mergeTags(dto.tags, domainTags);

  const bookmark = await prisma.$transaction(async (tx) => {
    const bm = await tx.bookmark.create({
      data: {
        url: normalized,
        urlHash: hash,
        title: dto.title,
        description: dto.description,
        folderId: dto.folderId,
        userId,
        enrichStatus: 'PENDING',
      },
    });

    // Tag manuali
    if (dto.tags.length > 0) {
      await upsertTags(tx, bm.id, userId, dto.tags, 'MANUAL');
    }
    // Tag da regex (escludiamo quelli già inseriti come manuali)
    const regexOnly = domainTags.filter((t) => !dto.tags.includes(t));
    if (regexOnly.length > 0) {
      await upsertTags(tx, bm.id, userId, regexOnly, 'REGEX');
    }

    return bm;
  });

  // Dispatch job asincroni (bulk per efficienza)
  await enrichQueue.addBulk([
    { name: 'enrich', data: { bookmarkId: bookmark.id, url: normalized } },
  ]);
  await healthCheckQueue.addBulk([
    { name: 'health-check', data: { bookmarkId: bookmark.id, url: normalized } },
  ]);
  await tagQueue.addBulk([
    {
      name: 'tag',
      data: {
        bookmarkId: bookmark.id,
        userId,
        url: normalized,
        title: dto.title,
        description: dto.description,
      },
    },
  ]);

  return bookmark;
}

export async function listBookmarks(dto: ListBookmarksDto, userId: string) {
  const { page, limit, folderId, tagId, search, enrichStatus, isRead } = dto;
  const skip = (page - 1) * limit;

  const where = {
    userId,
    deletedAt: null,
    ...(folderId && { folderId }),
    ...(enrichStatus && { enrichStatus }),
    ...(isRead !== undefined && { isRead }),
    ...(tagId && { tags: { some: { tagId } } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { url: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      include: {
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { id: true, name: true, source: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bookmark.count({ where }),
  ]);

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getBookmarkById(id: string, userId: string) {
  const bm = await prisma.bookmark.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      folder: true,
      tags: { include: { tag: true } },
    },
  });
  if (!bm) throw new AppError(404, 'Bookmark non trovato');
  return bm;
}

export async function updateBookmark(id: string, dto: UpdateBookmarkDto, userId: string) {
  await assertExists(id, userId);

  return prisma.$transaction(async (tx) => {
    const bm = await tx.bookmark.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
        ...(dto.isRead !== undefined && { isRead: dto.isRead }),
      },
    });

    if (dto.tags !== undefined) {
      // Rimuove solo i tag MANUAL — preserva REGEX e AI
      await tx.bookmarkTag.deleteMany({ where: { bookmarkId: id, source: 'MANUAL' } });
      await upsertTags(tx, id, userId, dto.tags, 'MANUAL');
    }

    return bm;
  });
}

/** Soft delete: setta deletedAt, il record rimane nel DB. */
export async function softDeleteBookmark(id: string, userId: string) {
  await assertExists(id, userId);
  return prisma.bookmark.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Hard delete: rimozione definitiva (usato da admin o su richiesta esplicita). */
export async function hardDeleteBookmark(id: string, userId: string) {
  await assertExists(id, userId);
  return prisma.bookmark.delete({ where: { id } });
}
