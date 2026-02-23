import { z } from 'zod';

export const createBookmarkSchema = z.object({
  url: z.string().url('URL non valido'),
  title: z.string().min(1).max(500),
  description: z.string().max(2_000).optional(),
  folderId: z.string().cuid().optional(),
  tags: z.array(z.string().min(1).max(100)).default([]),
});

export const updateBookmarkSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2_000).nullable().optional(),
  folderId: z.string().cuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
});

export const listBookmarksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  folderId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
  search: z.string().max(200).optional(),
  enrichStatus: z.enum(['PENDING', 'PROCESSING', 'DONE', 'FAILED']).optional(),
});

export type CreateBookmarkDto = z.infer<typeof createBookmarkSchema>;
export type UpdateBookmarkDto = z.infer<typeof updateBookmarkSchema>;
export type ListBookmarksDto = z.infer<typeof listBookmarksSchema>;
