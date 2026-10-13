import { Router, type NextFunction, type Request, type Response } from 'express';
import * as service from './extension.service';
import { agentResultSchema } from './extension.schema';
import { AppError } from '../../middleware/error.middleware';

// ── Per Linko (utente con JWT): collegamento e stato ─────────────────────────

export const extensionRouter = Router();

extensionRouter.get('/', async (req, res, next) => {
  try {
    res.json(await service.status(req.user.id));
  } catch (err) { next(err); }
});

// Token per collegare l'estensione: in chiaro solo in questa risposta
extensionRouter.post('/tokens', async (req, res, next) => {
  try {
    res.status(201).json(await service.createToken(req.user.id));
  } catch (err) { next(err); }
});

extensionRouter.delete('/tokens/:id', async (req, res, next) => {
  try {
    await service.revokeToken(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Per l'estensione (token dell'estensione, non il JWT) ─────────────────────

async function requireExtension(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const auth = token
      ? await service.authenticate(token, {
          version: req.header('x-linko-extension') ?? undefined,
          browser: req.header('x-linko-browser') ?? undefined,
        })
      : null;
    if (!auth) return next(new AppError(401, 'Estensione non collegata: ricollegala da Linko'));
    req.user = { id: auth.userId };
    next();
  } catch (err) { next(err); }
}

export const agentRouter = Router();
agentRouter.use(requireExtension);

agentRouter.get('/jobs', async (req, res, next) => {
  try {
    res.json(await service.jobs(req.user.id));
  } catch (err) { next(err); }
});

agentRouter.post('/results', async (req, res, next) => {
  try {
    res.json(await service.result(req.user.id, agentResultSchema.parse(req.body)));
  } catch (err) { next(err); }
});
