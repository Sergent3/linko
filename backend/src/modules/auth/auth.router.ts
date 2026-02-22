import { Router } from 'express';
import * as service from './auth.service';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';

export const authRouter = Router();

// POST /api/v1/auth/register
authRouter.post('/register', async (req, res, next) => {
  try {
    const dto = registerSchema.parse(req.body);
    const result = await service.register(dto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await service.login(dto);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await service.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await service.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
