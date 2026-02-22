import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Richiesto da BullMQ
  enableReadyCheck: false,
});

redis.on('connect', () => console.log('[redis] Worker connected'));
redis.on('error', (err) => console.error('[redis] Error:', err.message));
