/**
 * Sync Service — importazione massiva da estensione browser
 *
 * Accetta un albero di segnalibri in formato JSON (come restituito da
 * chrome.bookmarks.getTree) e lo importa nel DB ricreando la struttura
 * di cartelle e applicando il TagEngine (regex) su ogni URL.
 *
 * Il tagging AI avviene in background via BullMQ (tagQueue),
 * già dispatchato da createBookmark.
 */

import { z } from 'zod';
import { createBookmark } from '../bookmarks/bookmarks.service';
import { createFolder } from '../folders/folders.service';
import { AppError } from '../../middleware/error.middleware';

// ─────────────────────────────────────────────────────────────────────────────
// Schema Zod (ricorsivo)
// ─────────────────────────────────────────────────────────────────────────────

export interface BmLeaf   { title: string; url: string; }
export interface BmFolder { title: string; children: BmNode[]; }
export type BmNode = BmLeaf | BmFolder;

const BmNodeSchema: z.ZodType<BmNode> = z.lazy(() =>
  z.union([
    z.object({
      title: z.string().max(500),
      url: z.string().url().max(2048),
    }),
    z.object({
      title: z.string().max(500),
      children: z.array(BmNodeSchema).max(2000),
    }),
  ]),
);

export const SyncBodySchema = z.object({
  /** Radici dell'albero — solitamente "Barra dei segnalibri", "Altri segnalibri", ecc. */
  tree: z.array(BmNodeSchema).max(20),
});

export type SyncBody = z.infer<typeof SyncBodySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Risultato
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  imported: number;
  duplicates: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Walker ricorsivo
// ─────────────────────────────────────────────────────────────────────────────

async function walkTree(
  nodes: BmNode[],
  userId: string,
  parentId: string | undefined,
  result: SyncResult,
): Promise<void> {
  for (const node of nodes) {
    if ('url' in node) {
      // ── Bookmark leaf ──
      try {
        await createBookmark(
          {
            url: node.url,
            title: node.title || new URL(node.url).hostname,
            tags: [],
            folderId: parentId,
          },
          userId,
        );
        result.imported++;
      } catch (err: unknown) {
        if ((err as AppError)?.statusCode === 409) {
          result.duplicates++;
        } else {
          result.errors++;
          console.error('[sync] Errore su bookmark:', node.url, (err as Error)?.message);
        }
      }
    } else {
      // ── Folder node ──
      if (!node.title || node.children.length === 0) continue;
      try {
        const folder = await createFolder(node.title, parentId, userId);
        await walkTree(node.children, userId, folder.id, result);
      } catch (err: unknown) {
        console.error('[sync] Errore su cartella:', node.title, (err as Error)?.message);
        result.errors++;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function syncBookmarks(tree: BmNode[], userId: string): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, duplicates: 0, errors: 0 };
  await walkTree(tree, userId, undefined, result);
  return result;
}
