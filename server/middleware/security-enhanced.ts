
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Enhanced rate limiting with different tiers
class EnhancedRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number = 15 * 60 * 1000; // 15 minutes
  private readonly limits = {
    api: 100,
    auth: 10,
    default: 50
  };

  middleware(tier: keyof typeof this.limits = 'default') {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const key = `${ip}-${tier}`;
      
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }
      
      const requests = this.requests.get(key)!;
      const windowStart = now - this.windowMs;
      
      // Remove old requests
      const recentRequests = requests.filter(time => time > windowStart);
      this.requests.set(key, recentRequests);
      
      if (recentRequests.length >= this.limits[tier]) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for ${tier} endpoints`,
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

// Enhanced security headers
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:;");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  };
}

// Enhanced request logging with audit trail
export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const method = req.method;
      const url = req.url;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method,
        url,
        status,
        duration,
        ip,
        userAgent: userAgent.substring(0, 200) // Truncate long user agents
      };
      
      console.log(JSON.stringify(logEntry));
      
      if (status >= 400) {
        console.error(`Error response: ${method} ${url} - ${status} - ${duration}ms - ID: ${requestId}`);
      }
    });
    next();
  };
}

// Enhanced error handler with detailed logging
export function errorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId || 'unknown';
    
    console.error(`Error [${requestId}]:`, {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    
    if (res.headersSent) {
      return next(err);
    }
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: isDevelopment ? err.message : 'Internal server error',
        category: err.category || 'server',
        retryable: err.retryable !== false,
        ...(isDevelopment && { stack: err.stack })
      },
      requestId,
      timestamp: new Date().toISOString()
    });
  };
}

// JSON payload validation
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

export const rateLimiter = new EnhancedRateLimiter();
