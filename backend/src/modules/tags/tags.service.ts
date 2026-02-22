import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export async function listTags(userId: string) {
  return prisma.tag.findMany({
    where: { userId },
    include: { _count: { select: { bookmarks: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function deleteTag(id: string, userId: string) {
  const tag = await prisma.tag.findFirst({ where: { id, userId } });
  if (!tag) throw new AppError(404, 'Tag non trovato');
  // BookmarkTag viene eliminato in cascade grazie allo schema Prisma
  return prisma.tag.delete({ where: { id } });
}
