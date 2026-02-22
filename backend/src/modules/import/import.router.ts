import { Router } from 'express';
import { upload, importBookmarksFile } from './import.service';
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
