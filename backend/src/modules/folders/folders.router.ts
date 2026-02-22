import { Router } from 'express';
import { z } from 'zod';
import * as service from './folders.service';

export const foldersRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().cuid().optional(),
});

const renameSchema = z.object({ name: z.string().min(1).max(255) });

// GET /api/v1/folders
foldersRouter.get('/', async (req, res, next) => {
  try {
    res.json(await service.listFolders(req.user.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/folders
foldersRouter.post('/', async (req, res, next) => {
  try {
    const { name, parentId } = createSchema.parse(req.body);
    res.status(201).json(await service.createFolder(name, parentId, req.user.id));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/folders/:id
foldersRouter.patch('/:id', async (req, res, next) => {
  try {
    const { name } = renameSchema.parse(req.body);
    res.json(await service.renameFolder(req.params.id, name, req.user.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/folders/:id
foldersRouter.delete('/:id', async (req, res, next) => {
  try {
    await service.deleteFolder(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
