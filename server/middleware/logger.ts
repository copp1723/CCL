import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Logs method, path, status, and API key fingerprint (not value).
 * Add as early middleware in Express.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  // Capture API key if present (but privacy-safe, only fingerprinted)
  const apiKey = req.header('x-api-key') || req.header('authorization')?.replace('Bearer ', '') || '';
  const apiKeyHash = apiKey ? crypto.createHash('sha256').update(apiKey).digest('hex').substr(0, 8) : 'none';

  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`API | ${req.method} ${req.originalUrl} | status=${res.statusCode} | key=${apiKeyHash} | ${ms}ms`);
  });

  next();
}