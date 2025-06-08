import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

// Rate limit by API key (or by IP if no API key supplied)
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each API key (or IP) to 100 requests per windowMs
  keyGenerator: (req: Request, _res: Response) => {
    // Use API key as the rate-limiting key if present, else fallback to IP
    const apiKey = req.header('x-api-key') || req.header('authorization')?.replace('Bearer ', '');
    return apiKey || req.ip;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Too many requests, slow down.' });
  },
});