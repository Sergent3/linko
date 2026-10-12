import { Queue, QueueEvents } from 'bullmq';
import { redis } from './redis';

export const QUEUE_NAMES = {
  ENRICH: 'linko-enrich',
  HEALTH_CHECK: 'linko-health-check',
  TAG: 'linko-tag',
  WATCH: 'linko-watch',
} as const;

const defaultOpts = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 },
};

export const enrichQueue = new Queue(QUEUE_NAMES.ENRICH, {
  connection: redis,
  defaultJobOptions: defaultOpts,
});

export const healthCheckQueue = new Queue(QUEUE_NAMES.HEALTH_CHECK, {
  connection: redis,
  defaultJobOptions: { ...defaultOpts, attempts: 2 },
});

export const tagQueue = new Queue(QUEUE_NAMES.TAG, {
  connection: redis,
  defaultJobOptions: { ...defaultOpts, attempts: 2 },
});

// Monitoraggio fonti: il backend non scarica pagine esterne, delega al worker
// (che applica protezione SSRF e rate limit) e ne attende il risultato.
export const watchQueue = new Queue(QUEUE_NAMES.WATCH, { connection: redis });
export const watchQueueEvents = new QueueEvents(QUEUE_NAMES.WATCH, { connection: redis.duplicate() });
