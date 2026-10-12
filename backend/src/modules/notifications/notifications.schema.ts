import { z } from 'zod';

export const updateSettingsSchema = z.object({
  // Stessa sintassi del filtro delle fonti: parola, "frase", -esclusa
  keywords: z.string().max(500).optional(),
  digestHour: z.coerce.number().int().min(0).max(23).optional(),
});

export const telegramTokenSchema = z.object({
  token: z.string().trim().regex(/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/, 'Il token del bot non ha il formato giusto (es. 123456789:AA…)'),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
