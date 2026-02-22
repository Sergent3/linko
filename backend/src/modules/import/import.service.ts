import multer from 'multer';
import { parseBookmarksHtml, ParsedFolder } from './parser';
import { createBookmark } from '../bookmarks/bookmarks.service';
import { createFolder } from '../folders/folders.service';
import { AppError } from '../../middleware/error.middleware';

// Memory storage: il file non tocca mai il filesystem del server
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10 MB
  fileFilter: (_req, file, cb) => {
    const isHtml =
      file.mimetype === 'text/html' ||
      file.mimetype === 'application/xhtml+xml' ||
      file.originalname.toLowerCase().endsWith('.html');
    if (isHtml) cb(null, true);
    else cb(new AppError(400, 'Sono accettati solo file .html (Netscape Bookmark Format)'));
  },
});

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  stats: {
    totalBookmarks: number;
    totalFolders: number;
    duplicatesSkipped: number;
    malformedSkipped: number;
  };
}

/**
 * Crea ricorsivamente le cartelle nel DB seguendo l'albero parsato,
 * ritornando una mappa breadcrumb → dbFolderId.
 */
async function buildFolderMap(
  folders: ParsedFolder[],
  userId: string,
  parentId?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const folder of folders) {
    const dbFolder = await createFolder(folder.name, parentId, userId);
    const key = folder.path.join('/');
    map.set(key, dbFolder.id);

    if (folder.children.length > 0) {
      const childMap = await buildFolderMap(folder.children, userId, dbFolder.id);
      childMap.forEach((v, k) => map.set(k, v));
    }
  }

  return map;
}

export async function importBookmarksFile(
  fileBuffer: Buffer,
  userId: string,
): Promise<ImportResult> {
  const html = fileBuffer.toString('utf-8');
  const { bookmarks, folders, stats } = parseBookmarksHtml(html);

  // 1) Ricrea la struttura delle cartelle nel DB
  const folderMap = await buildFolderMap(folders, userId);

  // 2) Importa i bookmark in sequenza per evitare race condition sull'upsert dei tag
  let imported = 0;
  let errors = 0;

  for (const bm of bookmarks) {
    try {
      const folderKey = bm.folderPath.join('/');
      const folderId = folderKey ? folderMap.get(folderKey) : undefined;

      await createBookmark(
        {
          url: bm.url,
          title: bm.title,
          tags: [],
          folderId,
        },
        userId,
      );
      imported++;
    } catch (err: unknown) {
      const appErr = err as AppError;
      if (appErr?.statusCode === 409) {
        // Duplicato rilevato dal service — già contato nel parser come duplicatesSkipped
      } else {
        errors++;
        console.error('[import] Errore su bookmark:', bm.url, appErr?.message);
      }
    }
  }

  return { imported, duplicates: stats.duplicatesSkipped, errors, stats };
}
