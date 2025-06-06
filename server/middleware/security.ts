import { Request, Response, NextFunction } from 'express';
import config from '../config/environment';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor() {
    const rateLimitConfig = config.getRateLimitConfig();
    this.windowMs = rateLimitConfig.windowMs;
    this.maxRequests = rateLimitConfig.max;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + this.windowMs
        };
      } else {
        this.store[key].count++;
      }

      const remaining = Math.max(0, this.maxRequests - this.store[key].count);
      const resetTime = Math.ceil((this.store[key].resetTime - now) / 1000);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString()
      });

      if (this.store[key].count > this.maxRequests) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            category: 'rate_limit',
            retryable: true,
            retryAfter: resetTime
          },
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }
}

export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });

    // CORS configuration
    const corsOrigin = config.get().CORS_ORIGIN;
    if (corsOrigin !== '*') {
      res.set('Access-Control-Allow-Origin', corsOrigin);
    }

    next();
  };
}

export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent') || 'unknown';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      // Log format: timestamp method url status duration ip userAgent
      console.log(`${new Date().toISOString()} ${method} ${url} ${statusCode} ${duration}ms ${ip} "${userAgent}"`);
      
      // Log errors and slow requests
      if (statusCode >= 400) {
        console.error(`Error response: ${method} ${url} - ${statusCode} - ${duration}ms`);
      }
      
      if (duration > 1000) {
        console.warn(`Slow request: ${method} ${url} - ${duration}ms`);
      }
    });

    next();
  };
}

export function errorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // Log the error
    console.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Determine error type and response
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (err.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = 'Invalid request data';
    } else if (err.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
      message = 'Authentication required';
    } else if (err.code === 'ENOTFOUND') {
      statusCode = 503;
      errorCode = 'SERVICE_UNAVAILABLE';
      message = 'External service unavailable';
    }

    // Don't expose internal errors in production
    if (config.isProductionMode()) {
      message = statusCode === 500 ? 'Internal server error' : message;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        category: 'server_error',
        retryable: statusCode >= 500,
        ...(config.isDevelopment() && { stack: err.stack })
      },
      timestamp: new Date().toISOString()
    });
  };
}

export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    next();
  };
}

export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const method = req.method;
      const url = req.url;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      
      console.log(`${new Date().toISOString()} ${method} ${url} ${status} ${duration}ms ${ip} "${userAgent}"`);
      
      if (status >= 400) {
        console.log(`Error response: ${method} ${url} - ${status} - ${duration}ms`);
      }
    });
    next();
  };
}

export function errorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    
    if (res.headersSent) {
      return next(err);
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        category: 'server',
        retryable: true
      },
      timestamp: new Date().toISOString()
    });
  };
}

export function validateJsonPayload() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.get('Content-Type');
      
      if (contentType && contentType.includes('application/json')) {
        if (!req.body || typeof req.body !== 'object') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Invalid JSON payload',
              category: 'validation',
              retryable: false
            },
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    next();
  };
}

import { Request, Response, NextFunction } from 'express';

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number = 15 * 60 * 1000; // 15 minutes
  private readonly maxRequests: number = 100;

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      if (!this.requests.has(ip)) {
        this.requests.set(ip, []);
      }
      
      const requests = this.requests.get(ip)!;
      const windowStart = now - this.windowMs;
      
      // Remove old requests
      const recentRequests = requests.filter(time => time > windowStart);
      this.requests.set(ip, recentRequests);
      
      if (recentRequests.length >= this.maxRequests) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            category: 'rate_limit',
            retryable: true
          },
          timestamp: new Date().toISOString()
        });
      }
      
      recentRequests.push(now);
      next();
    };
  }
}

export const rateLimiter = new RateLimiter();