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
