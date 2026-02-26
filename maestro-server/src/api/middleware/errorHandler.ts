import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/common/Errors';

/**
 * Shared Express error-handling middleware.
 * Converts AppError subclasses to structured JSON responses and catches unknown errors.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }
  res.status(500).json({
    error: true,
    message: err.message,
    code: 'INTERNAL_ERROR'
  });
}

/**
 * Route-level error helper (for use in try/catch blocks inside route handlers).
 * Sends a structured error response without calling next().
 */
export function handleRouteError(err: unknown, res: Response): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({
    error: true,
    message,
    code: 'INTERNAL_ERROR'
  });
}
