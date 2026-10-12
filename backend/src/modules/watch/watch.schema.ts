import { z } from 'zod';

// Frequenze proposte nel wizard: 15 e 30 minuti (forum veloci), 1 ora, 6 ore, 24 ore
export const INTERVALS = [15, 30, 60, 360, 1440] as const;

const interval = z.coerce
  .number()
  .int()
  .refine((n) => (INTERVALS as readonly number[]).includes(n), 'Frequenza non valida');

const selector = z.string().trim().min(1).max(500);
const filter = z.string().max(500);
// Categoria della fonte: stringa vuota o null la tolgono
const category = z
  .string()
  .trim()
  .max(40, 'Nome della categoria troppo lungo (max 40 caratteri)')
  .nullable()
  .transform((v) => (v ? v : null));
// Filtro per categoria negli elenchi: "-" indica le fonti senza categoria
const categoryFilter = z.string().trim().min(1).max(40);

export const previewSchema = z.object({
  url: z.string().url('URL non valido'),
  selector: selector.optional(),
});

// Una fonte segue un'area della pagina (selector), un feed (feedUrl) o le risposte di una discussione (thread)
export const createSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    url: z.string().url('URL non valido'),
    selector: selector.optional(),
    feedUrl: z.string().url('URL del feed non valido').optional(),
    thread: z.boolean().optional(),
    kind: z.enum(['SITE', 'FORUM']).default('SITE'),
    filter: filter.default(''),
    intervalMinutes: interval.default(60),
    category: category.optional(),
    bookmarkId: z.string().cuid().optional(),
  })
  .refine((d) => [!!d.selector, !!d.feedUrl, !!d.thread].filter(Boolean).length === 1, {
    message: 'Indica un\'area (selector), un feed (feedUrl) oppure una discussione (thread), uno solo',
    path: ['selector'],
  });

// Cosa monitorare si cambia indicando al massimo uno tra selector, feedUrl e thread
export const updateSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    url: z.string().url('URL non valido').optional(),
    selector: selector.optional(),
    feedUrl: z.string().url('URL del feed non valido').optional(),
    thread: z.boolean().optional(),
    kind: z.enum(['SITE', 'FORUM']).optional(),
    filter: filter.optional(),
    intervalMinutes: interval.optional(),
    category: category.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => [!!d.selector, !!d.feedUrl, !!d.thread].filter(Boolean).length <= 1, {
    message: 'Indica un\'area (selector), un feed (feedUrl) oppure una discussione (thread), uno solo',
    path: ['selector'],
  });

export const listItemsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sourceId: z.string().cuid().optional(),
  // Tutte le fonti dello stesso sito (host senza www)
  domain: z.string().trim().min(3).max(253).regex(/^[a-z0-9.-]+$/i, 'Dominio non valido').optional(),
  category: categoryFilter.optional(),
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ── Accessi ai siti (cookie) ────────────────────────────────────────────────

export const saveCredentialSchema = z.object({
  // URL o dominio del sito: viene ridotto al dominio (senza www)
  site: z.string().trim().min(3).max(500),
  cookie: z.string().min(1, 'Incolla i cookie del sito').max(20_000),
  userAgent: z.string().max(512).optional(),
  // Pagina su cui provare subito il cookie (default: la home del dominio)
  testUrl: z.string().url().optional(),
});

export const verifyCredentialSchema = z.object({
  testUrl: z.string().url().optional(),
});

export const updateItemSchema = z.object({
  isRead: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const readAllSchema = z.object({
  sourceId: z.string().cuid().optional(),
  domain: z.string().trim().min(3).max(253).regex(/^[a-z0-9.-]+$/i, 'Dominio non valido').optional(),
  category: categoryFilter.optional(),
});

// Nuovo ordine personalizzato: tutti gli id delle fonti nell'ordine voluto
export const reorderSourcesSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(1000),
});

// Rinomina (o elimina, con "to" vuoto) una categoria su tutte le sue fonti
export const renameCategorySchema = z.object({
  from: z.string().trim().min(1).max(40),
  to: category,
});

export type PreviewDto = z.infer<typeof previewSchema>;
export type CreateSourceDto = z.infer<typeof createSourceSchema>;
export type UpdateSourceDto = z.infer<typeof updateSourceSchema>;
export type ListItemsDto = z.infer<typeof listItemsSchema>;
export type ReadAllDto = z.infer<typeof readAllSchema>;
export type UpdateItemDto = z.infer<typeof updateItemSchema>;
export type SaveCredentialDto = z.infer<typeof saveCredentialSchema>;
