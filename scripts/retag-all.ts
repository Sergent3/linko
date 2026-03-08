/**
 * Ri-dispatcha job di tagging AI per tutti i bookmark senza tag.
 * Uso: DATABASE_URL=... REDIS_URL=... tsx scripts/retag-all.ts
 */
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

const DATABASE_URL = process.env.DATABASE_URL!;
const REDIS_URL    = process.env.REDIS_URL ?? 'redis://localhost:6379';

if (!DATABASE_URL) { console.error('DATABASE_URL mancante'); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const redis  = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const tagQueue = new Queue('linko-tag', { connection: redis });

async function main() {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      deletedAt: null,
      tags: { none: {} },
    },
    select: { id: true, url: true, title: true, description: true, userId: true },
  });

  console.log(`[retag] ${bookmarks.length} bookmark senza tag — dispatching jobs...`);

  const jobs = bookmarks.map((b) => ({
    name: 'tag',
    data: {
      bookmarkId:  b.id,
      userId:      b.userId,
      url:         b.url,
      title:       b.title ?? '',
      description: b.description ?? undefined,
    },
  }));

  // Batch da 100 per non sovraccaricare Redis in una sola chiamata
  const BATCH = 100;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await tagQueue.addBulk(jobs.slice(i, i + BATCH));
    process.stdout.write(`\r  dispatched ${Math.min(i + BATCH, jobs.length)}/${jobs.length}`);
  }

  console.log('\n[retag] Done.');
  await prisma.$disconnect();
  await redis.quit();
}

main().catch((e) => { console.error(e); process.exit(1); });
