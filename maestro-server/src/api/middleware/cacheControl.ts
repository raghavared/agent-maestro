import { Request, Response, NextFunction } from 'express';

export function cacheControl(maxAge: number, options?: { immutable?: boolean; public?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parts = [`max-age=${maxAge}`];
    if (options?.public) parts.unshift('public');
    if (options?.immutable) parts.push('immutable');
    res.set('Cache-Control', parts.join(', '));
    next();
  };
}
