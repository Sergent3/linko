import { Router } from 'express';
import { upload, importBookmarksFile } from './import.service';
import { syncBookmarks, SyncBodySchema } from './sync.service';
import { AppError } from '../../middleware/error.middleware';

export const importRouter = Router();

// POST /api/v1/import
// Body: multipart/form-data con campo "file" → file .html Netscape Bookmark
importRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'Nessun file caricato');
    const result = await importBookmarksFile(req.file.buffer, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/import/sync
// Body: JSON { tree: BmNode[] } — albero segnalibri da estensione browser
importRouter.post('/sync', async (req, res, next) => {
  try {
    const parsed = SyncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Payload non valido: ' + parsed.error.issues[0]?.message);
    }
    const result = await syncBookmarks(parsed.data.tree, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
