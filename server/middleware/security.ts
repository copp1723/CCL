import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);
    
    if (!entry || now - entry.windowStart > this.windowMs) {
      // New window
      this.limits.set(identifier, {
        count: 1,
        windowStart: now,
      });
      return true;
    }
    
    if (entry.count >= this.maxRequests) {
      return false;
    }
    
    entry.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.windowStart > this.windowMs) {
        this.limits.delete(key);
      }
    }
  }
}

// Rate limiters for different endpoints
const chatRateLimiter = new RateLimiter(60000, 30); // 30 requests per minute for chat
const apiRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute for API
const webhookRateLimiter = new RateLimiter(60000, 10); // 10 requests per minute for webhooks

export function rateLimitMiddleware(type: 'chat' | 'api' | 'webhook' = 'api') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip || 'unknown';
    
    let limiter: RateLimiter;
    switch (type) {
      case 'chat':
        limiter = chatRateLimiter;
        break;
      case 'webhook':
        limiter = webhookRateLimiter;
        break;
      default:
        limiter = apiRateLimiter;
        break;
    }
    
    if (!limiter.isAllowed(identifier)) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
      });
      return;
    }
    
    next();
  };
}

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 1000); // Limit length
}

export function hashEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email provided for hashing');
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  return createHash('sha256').update(normalizedEmail).digest('hex');
}

export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // E.164 format validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

export function validateReturnToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

export function stripPII(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const piiFields = ['email', 'phone', 'ssn', 'address', 'firstName', 'lastName', 'fullName'];
  const cleaned = { ...data };
  
  for (const field of piiFields) {
    if (cleaned[field]) {
      delete cleaned[field];
    }
  }
  
  // Recursively clean nested objects
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === 'object' && value !== null) {
      cleaned[key] = stripPII(value);
    }
  }
  
  return cleaned;
}

export function logSecurityEvent(event: string, details: any, req?: Request): void {
  const timestamp = new Date().toISOString();
  const ip = req?.ip || 'unknown';
  const userAgent = req?.get('User-Agent') || 'unknown';
  
  console.log(`[SECURITY] ${timestamp} - ${event}`, {
    ip,
    userAgent,
    details: stripPII(details),
  });
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = [
    'http://localhost:5000',
    'https://app.completecarloans.com',
    ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
  ];
  
  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
}
