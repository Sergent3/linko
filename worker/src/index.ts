import { Queue, Worker } from 'bullmq';
import { redis } from './lib/redis';
import { prisma } from './lib/prisma';
import { config } from './config';
import { enrichProcessor } from './processors/enrich.processor';
import { healthCheckProcessor } from './processors/health-check.processor';
import { tagProcessor } from './processors/tag.processor';
import { createWatchProcessor, WATCH_QUEUE } from './processors/watch.processor';

const QUEUE_NAMES = {
  ENRICH: 'linko-enrich',
  HEALTH_CHECK: 'linko-health-check',
  TAG: 'linko-tag',
};

// ── Worker Definitions ────────────────────────────────────────────────────────

// Rate limiter: max 1 richiesta per SCRAPING_DELAY_MS → evita ban naïf
const enrichWorker = new Worker(QUEUE_NAMES.ENRICH, enrichProcessor, {
  connection: redis,
  concurrency: config.WORKER_CONCURRENCY,
  limiter: { max: 1, duration: config.SCRAPING_DELAY_MS },
});

// Health check: più leggero (solo HEAD), concorrenza più alta
const healthCheckWorker = new Worker(QUEUE_NAMES.HEALTH_CHECK, healthCheckProcessor, {
  connection: redis,
  concurrency: config.WORKER_CONCURRENCY * 2,
});

// AI tagging: concorrenza 1 per controllare i costi API
const tagWorker = new Worker(QUEUE_NAMES.TAG, tagProcessor, {
  connection: redis,
  concurrency: 1,
});

// Monitoraggio fonti: stesso rate limit dello scraping, i preview del wizard
// passano dalla stessa coda così ogni richiesta verso l'esterno è limitata
const watchQueue = new Queue(WATCH_QUEUE, { connection: redis });
const watchWorker = new Worker(WATCH_QUEUE, createWatchProcessor(watchQueue), {
  connection: redis,
  concurrency: 3,
  limiter: { max: 1, duration: config.SCRAPING_DELAY_MS },
});

// Job ricorrenti: BullMQ li de-duplica per jobId, sicuro anche con più repliche
void watchQueue.add('tick', { type: 'tick' }, { repeat: { every: 60_000 }, jobId: 'watch-tick', removeOnComplete: true, removeOnFail: 50 });
void watchQueue.add('cleanup', { type: 'cleanup' }, { repeat: { pattern: '15 4 * * *' }, jobId: 'watch-cleanup', removeOnComplete: true, removeOnFail: 10 });

// ── Lifecycle & Logging ───────────────────────────────────────────────────────

const workers = [enrichWorker, healthCheckWorker, tagWorker, watchWorker];

workers.forEach((w) => {
  w.on('completed', (job) => {
    if (job.name !== 'tick') console.log(`[worker:${w.name}] Job ${job.id} completato`);
  });
  w.on('failed', (job, err) =>
    console.error(`[worker:${w.name}] Job ${job?.id} fallito: ${err.message}`),
  );
  w.on('error', (err) =>
    console.error(`[worker:${w.name}] Errore worker: ${err.message}`),
  );
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

async function shutdown() {
  console.log('[worker] Graceful shutdown in corso...');
  await Promise.all(workers.map((w) => w.close()));
  await watchQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(
  `[linko-worker] Avviato | concurrency=${config.WORKER_CONCURRENCY} | delay=${config.SCRAPING_DELAY_MS}ms`,
);
