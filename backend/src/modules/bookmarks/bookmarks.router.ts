import { Router } from 'express';
import * as service from './bookmarks.service';
import { createBookmarkSchema, updateBookmarkSchema, listBookmarksSchema } from './bookmarks.schema';

export const bookmarksRouter = Router();

// GET /api/v1/bookmarks
bookmarksRouter.get('/', async (req, res, next) => {
  try {
    const query = listBookmarksSchema.parse(req.query);
    res.json(await service.listBookmarks(query, req.user.id));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bookmarks/export/html
bookmarksRouter.get('/export/html', async (req, res, next) => {
  try {
    const result = await service.listBookmarks({ page: 1, limit: 100000 }, req.user.id);
    
    // Raggruppa per cartella
    const folders: Record<string, typeof result.data> = { 'Uncategorized': [] };
    result.data.forEach(b => {
      if (!b.folderId) folders['Uncategorized'].push(b);
      else {
        const fName = b.folder?.name || 'Unknown';
        if (!folders[fName]) folders[fName] = [];
        folders[fName].push(b);
      }
    });

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n`;

    for (const [folderName, bms] of Object.entries(folders)) {
      if (bms.length === 0) continue;
      if (folderName !== 'Uncategorized') {
        html += `    <DT><H3>${folderName}</H3>\n    <DL><p>\n`;
      }
      for (const b of bms) {
        const indent = folderName !== 'Uncategorized' ? '        ' : '    ';
        const date = Math.floor(new Date(b.createdAt).getTime() / 1000);
        html += `${indent}<DT><A HREF="${b.url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" ADD_DATE="${date}">${(b.title || b.url).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</A>\n`;
      }
      if (folderName !== 'Uncategorized') {
        html += `    </DL><p>\n`;
      }
    }
    html += `</DL><p>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="linko_bookmarks.html"');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bookmarks/:id
bookmarksRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await service.getBookmarkById(req.params.id, req.user.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bookmarks
bookmarksRouter.post('/', async (req, res, next) => {
  try {
    const dto = createBookmarkSchema.parse(req.body);
    res.status(201).json(await service.createBookmark(dto, req.user.id));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/bookmarks/:id
bookmarksRouter.patch('/:id', async (req, res, next) => {
  try {
    const dto = updateBookmarkSchema.parse(req.body);
    res.json(await service.updateBookmark(req.params.id, dto, req.user.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/bookmarks/:id  →  soft delete
bookmarksRouter.delete('/:id', async (req, res, next) => {
  try {
    await service.softDeleteBookmark(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/bookmarks/:id/permanent  →  hard delete
bookmarksRouter.delete('/:id/permanent', async (req, res, next) => {
  try {
    await service.hardDeleteBookmark(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
