import { z } from 'zod';

export const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'endpoint non HTTPS'),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
});

export const unsubscribeSchema = z.object({ endpoint: z.string().max(2000) });

/** Avviso inviato da un servizio interno (es. il viewer remoto). */
export const internalNotifySchema = z.object({
  userId: z.string().min(1).max(50),
  kind: z.string().regex(/^[a-z_]{1,40}$/),
  title: z.string().min(1).max(120),
  body: z.string().max(500).default(''),
  // Solo percorsi di Linko: l'avviso non può portare su siti esterni
  url: z.string().max(500).regex(/^\/(?!\/)/).optional(),
});

export type InternalNotifyDto = z.infer<typeof internalNotifySchema>;
