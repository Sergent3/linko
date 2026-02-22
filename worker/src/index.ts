import { Worker } from 'bullmq';
import { redis } from './lib/redis';
import { prisma } from './lib/prisma';
import { config } from './config';
import { enrichProcessor } from './processors/enrich.processor';
import { healthCheckProcessor } from './processors/health-check.processor';
import { tagProcessor } from './processors/tag.processor';

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

// ── Lifecycle & Logging ───────────────────────────────────────────────────────

const workers = [enrichWorker, healthCheckWorker, tagWorker];

workers.forEach((w) => {
  w.on('completed', (job) =>
    console.log(`[worker:${w.name}] Job ${job.id} completato`),
  );
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
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(
  `[linko-worker] Avviato | concurrency=${config.WORKER_CONCURRENCY} | delay=${config.SCRAPING_DELAY_MS}ms`,
);
