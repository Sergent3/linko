import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(5),
  SCRAPING_DELAY_MS: z.coerce.number().int().min(0).default(1_200),
  SCRAPING_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(10_000),
  HTTP_CHECK_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(8_000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] Variabili d\'ambiente non valide:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
