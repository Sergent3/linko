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
  // I bookmark vengono scollegati (folderId → null) grazie a onDelete: SetNull nello schema
  return prisma.folder.delete({ where: { id } });
}
