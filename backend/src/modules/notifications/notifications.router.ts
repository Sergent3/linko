import { Router } from 'express';
import * as service from './notifications.service';
import { telegramTokenSchema, updateSettingsSchema } from './notifications.schema';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await service.getSettings(req.user.id));
  } catch (err) { next(err); }
});

notificationsRouter.patch('/', async (req, res, next) => {
  try {
    res.json(await service.updateSettings(req.user.id, updateSettingsSchema.parse(req.body)));
  } catch (err) { next(err); }
});

// Salva il token del bot (verificato con Telegram)
notificationsRouter.put('/telegram', async (req, res, next) => {
  try {
    res.json(await service.setTelegramToken(req.user.id, telegramTokenSchema.parse(req.body).token));
  } catch (err) { next(err); }
});

// Collega la chat in cui l'utente ha premuto Avvia, e manda un messaggio di prova
notificationsRouter.post('/telegram/link', async (req, res, next) => {
  try {
    res.json(await service.linkTelegram(req.user.id));
  } catch (err) { next(err); }
});

notificationsRouter.post('/telegram/test', async (req, res, next) => {
  try {
    res.json(await service.testTelegram(req.user.id));
  } catch (err) { next(err); }
});

notificationsRouter.delete('/telegram', async (req, res, next) => {
  try {
    res.json(await service.removeTelegram(req.user.id));
  } catch (err) { next(err); }
});
