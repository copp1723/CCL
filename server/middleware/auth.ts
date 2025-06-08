import { Request, Response, NextFunction } from 'express';
import { sendUnauthorized } from '../utils/response-formatter';

export function apiAuth(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.API_KEY;
  const header = req.headers['authorization'];
  if (!expectedKey) {
    console.warn('API_KEY environment variable is not set');
  }
  if (!header || header !== `Bearer ${expectedKey}`) {
    return sendUnauthorized(res, 'Invalid API key');
  }
  return next();
}
