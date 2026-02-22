import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Errori di validazione Zod → 422
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      issues: err.flatten().fieldErrors,
    });
    return;
  }

  // Errori applicativi attesi
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Errori inattesi: logga lo stack, non esporre dettagli al client
  console.error('[error]', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
}
