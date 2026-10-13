import { z } from 'zod';

// Dimensione massima della pagina inviata dall'estensione (come il limite del worker)
export const MAX_HTML_CHARS = 5 * 1024 * 1024;

export const fetchedPageSchema = z.object({
  url: z.string().url(),
  status: z.number().int().min(0).max(999),
  html: z.string().max(MAX_HTML_CHARS, 'Pagina troppo grande'),
});

// Esito del controllo di una fonte fatto dall'estensione: la pagina, oppure il motivo per cui manca
export const agentResultSchema = z
  .object({
    sourceId: z.string().cuid(),
    page: fetchedPageSchema.optional(),
    error: z.enum(['challenge', 'permission', 'network']).optional(),
    message: z.string().max(500).optional(),
  })
  .refine((d) => !!d.page !== !!d.error, { message: 'Indica la pagina oppure l\'errore', path: ['page'] });

export type AgentResultDto = z.infer<typeof agentResultSchema>;
