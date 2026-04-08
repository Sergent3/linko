import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export async function listFolders(userId: string) {
  return prisma.folder.findMany({
    where: { userId },
    include: {
      children: { include: { _count: { select: { bookmarks: true } } } },
      _count: { select: { bookmarks: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createFolder(name: string, parentId: string | undefined, userId: string) {
  if (parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: parentId, userId } });
    if (!parent) throw new AppError(404, 'Cartella padre non trovata');
  }

  // Upsert case-insensitive: riusa la cartella se esiste già con lo stesso nome e stesso parent
  const existing = await prisma.folder.findFirst({
    where: {
      userId,
      parentId: parentId ?? null,
      name: { equals: name, mode: 'insensitive' },
    },
  });
  if (existing) return existing;

  return prisma.folder.create({ data: { name, parentId, userId } });
}

export async function renameFolder(id: string, name: string, userId: string) {
  const folder = await prisma.folder.findFirst({ where: { id, userId } });
  if (!folder) throw new AppError(404, 'Cartella non trovata');
  return prisma.folder.update({ where: { id }, data: { name } });
}

export async function deleteFolder(id: string, userId: string) {
  const folder = await prisma.folder.findFirst({ where: { id, userId } });
  if (!folder) throw new AppError(404, 'Cartella non trovata');

  // Elimina ricorsivamente le sottocartelle (Postgres blocca l'eliminazione se ci sono figli)
  const children = await prisma.folder.findMany({ where: { parentId: id, userId } });
  for (const child of children) {
    await deleteFolder(child.id, userId);
  }

  // Elimina tutti i bookmark della cartella
  await prisma.bookmark.updateMany({ where: { folderId: id, userId }, data: { deletedAt: new Date() } });

  return prisma.folder.delete({ where: { id } });
}
