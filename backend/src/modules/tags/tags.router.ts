import { Router } from 'express';
import * as service from './tags.service';

export const tagsRouter = Router();

// GET /api/v1/tags
tagsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await service.listTags(req.user.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/tags/:id
tagsRouter.delete('/:id', async (req, res, next) => {
  try {
    await service.deleteTag(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
