import { z } from 'zod';

// Frequenze proposte nel wizard: 1 ora, 6 ore, 24 ore
export const INTERVALS = [60, 360, 1440] as const;

const interval = z.coerce
  .number()
  .int()
  .refine((n) => (INTERVALS as readonly number[]).includes(n), 'Frequenza non valida');

const selector = z.string().trim().min(1).max(500);
const filter = z.string().max(500);

export const previewSchema = z.object({
  url: z.string().url('URL non valido'),
  selector: selector.optional(),
});

// Una fonte segue un'area della pagina (selector) oppure un feed (feedUrl)
export const createSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    url: z.string().url('URL non valido'),
    selector: selector.optional(),
    feedUrl: z.string().url('URL del feed non valido').optional(),
    filter: filter.default(''),
    intervalMinutes: interval.default(360),
    bookmarkId: z.string().cuid().optional(),
  })
  .refine((d) => !!d.selector !== !!d.feedUrl, {
    message: 'Indica un\'area (selector) oppure un feed (feedUrl), non entrambi',
    path: ['selector'],
  });

export const updateSourceSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  selector: selector.optional(),
  filter: filter.optional(),
  intervalMinutes: interval.optional(),
  isActive: z.boolean().optional(),
});

export const listItemsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sourceId: z.string().cuid().optional(),
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const updateItemSchema = z.object({
  isRead: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const readAllSchema = z.object({
  sourceId: z.string().cuid().optional(),
});

export type PreviewDto = z.infer<typeof previewSchema>;
export type CreateSourceDto = z.infer<typeof createSourceSchema>;
export type UpdateSourceDto = z.infer<typeof updateSourceSchema>;
export type ListItemsDto = z.infer<typeof listItemsSchema>;
export type UpdateItemDto = z.infer<typeof updateItemSchema>;
