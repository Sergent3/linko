import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { errorMiddleware } from './middleware/error.middleware';
import { requireAuth } from './middleware/auth.middleware';
import { authRouter } from './modules/auth/auth.router';
import { bookmarksRouter } from './modules/bookmarks/bookmarks.router';
import { foldersRouter } from './modules/folders/folders.router';
import { tagsRouter } from './modules/tags/tags.router';
import { importRouter } from './modules/import/import.router';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'linko-backend', ts: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);

// Tutto ciò che segue richiede un JWT valido
app.use(requireAuth);
app.use('/api/v1/bookmarks', bookmarksRouter);
app.use('/api/v1/folders', foldersRouter);
app.use('/api/v1/tags', tagsRouter);
app.use('/api/v1/import', importRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorMiddleware);

app.listen(config.PORT, () => {
  console.log(`[linko-backend] Listening on port ${config.PORT} (${config.NODE_ENV})`);
});

export default app;
