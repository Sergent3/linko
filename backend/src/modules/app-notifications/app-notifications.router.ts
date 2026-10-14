import { Router } from 'express';
import * as service from './app-notifications.service';
import { internalNotifySchema, subscribeSchema, unsubscribeSchema } from './app-notifications.schema';

/** Campanella e iscrizioni push dell'utente (JWT). */
export const appNotificationsRouter = Router();

appNotificationsRouter.get('/', async (req, res, next) => {
  try { res.json(await service.list(req.user.id)); } catch (err) { next(err); }
});

appNotificationsRouter.post('/read-all', async (req, res, next) => {
  try { res.json(await service.markAllRead(req.user.id)); } catch (err) { next(err); }
});

appNotificationsRouter.post('/:id/read', async (req, res, next) => {
  try { res.json(await service.markRead(req.user.id, req.params.id)); } catch (err) { next(err); }
});

appNotificationsRouter.get('/push/key', async (req, res, next) => {
  try { // Origin non arriva sulle GET dello stesso sito: si ricava dal Referer
    let origin = req.get('origin');
    try { origin ??= new URL(req.get('referer') ?? '').origin; } catch { /* nessuno dei due */ }
    res.json({ publicKey: await service.vapidPublicKey(origin) });; } catch (err) { next(err); }
});

appNotificationsRouter.post('/push/subscribe', async (req, res, next) => {
  try { res.json(await service.subscribe(req.user.id, subscribeSchema.parse(req.body), req.get('user-agent'))); } catch (err) { next(err); }
});

appNotificationsRouter.post('/push/unsubscribe', async (req, res, next) => {
  try { res.json(await service.unsubscribe(req.user.id, unsubscribeSchema.parse(req.body).endpoint)); } catch (err) { next(err); }
});

appNotificationsRouter.post('/push/test', async (req, res, next) => {
  try { res.json(await service.sendTest(req.user.id)); } catch (err) { next(err); }
});

/** Avvisi dai servizi interni (viewer remoto), autenticati col segreto condiviso. */
export const internalRouter = Router();

internalRouter.post('/notify', async (req, res, next) => {
  try {
    if (!(await service.checkInternalSecret(req.get('x-linko-internal')))) return void res.status(403).json({ error: 'forbidden' });
    const n = await service.create(internalNotifySchema.parse(req.body));
    res.status(201).json({ id: n.id });
  } catch (err) { next(err); }
});
