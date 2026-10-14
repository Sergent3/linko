import { Router } from 'express';
import * as service from './watch.service';
import {
  createSourceSchema,
  listItemsSchema,
  previewSchema,
  readAllSchema,
  renameCategorySchema,
  reorderSourcesSchema,
  saveCredentialSchema,
  updateItemSchema,
  updateSourceSchema,
  verifyCredentialSchema,
} from './watch.schema';

export const watchRouter = Router();

// POST /api/v1/watch/preview  →  aree suggerite o elementi di un selettore
watchRouter.post('/preview', async (req, res, next) => {
  try {
    res.json(await service.preview(previewSchema.parse(req.body), req.user.id));
  } catch (err) { next(err); }
});

// ── Fonti ─────────────────────────────────────────────────────────────────────

watchRouter.get('/sources', async (req, res, next) => {
  try {
    res.json(await service.listSources(req.user.id));
  } catch (err) { next(err); }
});

watchRouter.post('/sources', async (req, res, next) => {
  try {
    res.status(201).json(await service.createSource(createSourceSchema.parse(req.body), req.user.id));
  } catch (err) { next(err); }
});

// Prima di /sources/:id
watchRouter.put('/sources/order', async (req, res, next) => {
  try {
    res.json(await service.reorderSources(reorderSourcesSchema.parse(req.body).ids, req.user.id));
  } catch (err) { next(err); }
});

watchRouter.post('/categories/rename', async (req, res, next) => {
  try {
    const { from, to } = renameCategorySchema.parse(req.body);
    res.json(await service.renameCategory(from, to, req.user.id));
  } catch (err) { next(err); }
});

watchRouter.patch('/sources/:id', async (req, res, next) => {
  try {
    res.json(await service.updateSource(req.params.id, updateSourceSchema.parse(req.body), req.user.id));
  } catch (err) { next(err); }
});

watchRouter.delete('/sources/:id', async (req, res, next) => {
  try {
    await service.deleteSource(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

watchRouter.post('/sources/:id/check', async (req, res, next) => {
  try {
    res.json(await service.checkNow(req.params.id, req.user.id));
  } catch (err) { next(err); }
});

watchRouter.get('/sources/:id/checks', async (req, res, next) => {
  try {
    res.json(await service.listChecks(req.params.id, req.user.id));
  } catch (err) { next(err); }
});

// ── Elementi ──────────────────────────────────────────────────────────────────

watchRouter.get('/items', async (req, res, next) => {
  try {
    res.json(await service.listItems(listItemsSchema.parse(req.query), req.user.id));
  } catch (err) { next(err); }
});

// Prima di /items/:id, altrimenti "read-all" verrebbe letto come id
watchRouter.post('/items/read-all', async (req, res, next) => {
  try {
    res.json(await service.markAllRead(req.user.id, readAllSchema.parse(req.body ?? {})));
  } catch (err) { next(err); }
});

watchRouter.patch('/items/:id', async (req, res, next) => {
  try {
    res.json(await service.updateItem(req.params.id, updateItemSchema.parse(req.body), req.user.id));
  } catch (err) { next(err); }
});

watchRouter.get('/items/:id', async (req, res, next) => {
  try {
    res.json(await service.getItem(req.params.id, req.user.id));
  } catch (err) { next(err); }
});

watchRouter.get('/items/:id/content', async (req, res, next) => {
  try {
    res.json(await service.itemContent(req.params.id, req.user.id));
  } catch (err) { next(err); }
});

watchRouter.post('/items/:id/save', async (req, res, next) => {
  try {
    res.json(await service.saveAsBookmark(req.params.id, req.user.id));
  } catch (err) { next(err); }
});

// ── Accessi ai siti (cookie) ──────────────────────────────────────────────────

watchRouter.get('/credentials', async (req, res, next) => {
  try {
    res.json(await service.listCredentials(req.user.id));
  } catch (err) { next(err); }
});

// Crea o sostituisce l'accesso del dominio e lo prova subito
watchRouter.put('/credentials', async (req, res, next) => {
  try {
    res.json(await service.saveCredential(saveCredentialSchema.parse(req.body), req.user.id));
  } catch (err) { next(err); }
});

watchRouter.post('/credentials/:id/verify', async (req, res, next) => {
  try {
    const { testUrl } = verifyCredentialSchema.parse(req.body ?? {});
    res.json(await service.verifyCredential(req.params.id, req.user.id, testUrl));
  } catch (err) { next(err); }
});

watchRouter.delete('/credentials/:id', async (req, res, next) => {
  try {
    await service.deleteCredential(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
});
