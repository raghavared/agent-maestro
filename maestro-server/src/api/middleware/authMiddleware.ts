import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../infrastructure/auth/AuthService';

// Paths exempt from the auth guard (always public)
const EXEMPT_PREFIXES = [
  '/api/auth/',
  '/health',
  '/ws-status',
];

export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authService.enabled) return next();

    for (const prefix of EXEMPT_PREFIXES) {
      if (req.path === prefix || req.path.startsWith(prefix)) return next();
    }

    const cookieToken = authService.extractTokenFromCookie(req.headers.cookie);
    // Accept ?token= query param as fallback (for non-browser clients)
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const token = cookieToken || queryToken;

    if (!token || !authService.verifyToken(token)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}
