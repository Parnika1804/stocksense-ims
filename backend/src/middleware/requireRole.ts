import { Request, Response, NextFunction } from 'express';

/**
 * Returns middleware that allows only users whose role is in `roles`.
 * Must be used AFTER requireAuth (which populates req.auth).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
