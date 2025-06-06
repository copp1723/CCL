import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { logSecurityEvent } from './security';

interface SecurityConfig {
  enableRateLimit: boolean;
  enableInputSanitization: boolean;
  enableSecurityHeaders: boolean;
  enableAuditLogging: boolean;
  maxRequestSize: string;
}

const securityConfig: SecurityConfig = {
  enableRateLimit: true,
  enableInputSanitization: true,
  enableSecurityHeaders: true,
  enableAuditLogging: true,
  maxRequestSize: '10mb',
};

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
}

class EnhancedRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private blockDuration: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100, blockDuration: number = 300000) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.blockDuration = blockDuration;

    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(identifier: string, req?: Request): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    // Check if currently blocked
    if (entry?.blocked && now - entry.windowStart < this.blockDuration) {
      logSecurityEvent('rate_limit_blocked_request', { identifier }, req);
      return { allowed: false, reason: 'IP temporarily blocked' };
    }

    if (!entry || now - entry.windowStart > this.windowMs) {
      // New window or unblock
      this.limits.set(identifier, {
        count: 1,
        windowStart: now,
        blocked: false,
      });
      return { allowed: true };
    }

    if (entry.count >= this.maxRequests) {
      // Block the IP
      entry.blocked = true;
      logSecurityEvent('rate_limit_exceeded', { 
        identifier, 
        count: entry.count,
        maxRequests: this.maxRequests,
      }, req);
      return { allowed: false, reason: 'Rate limit exceeded - IP blocked' };
    }

    entry.count++;
    return { allowed: true };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.windowStart > Math.max(this.windowMs, this.blockDuration)) {
        this.limits.delete(key);
      }
    }
  }
}

// Enhanced rate limiters
const apiRateLimiter = new EnhancedRateLimiter(60000, 100, 300000);
const authRateLimiter = new EnhancedRateLimiter(60000, 5, 900000); // Stricter for auth
const webhookRateLimiter = new EnhancedRateLimiter(60000, 10, 300000);

export function enhancedRateLimitMiddleware(type: 'api' | 'auth' | 'webhook' = 'api') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!securityConfig.enableRateLimit) {
      return next();
    }

    const identifier = req.ip || 'unknown';

    let limiter: EnhancedRateLimiter;
    switch (type) {
      case 'auth':
        limiter = authRateLimiter;
        break;
      case 'webhook':
        limiter = webhookRateLimiter;
        break;
      default:
        limiter = apiRateLimiter;
        break;
    }

    const result = limiter.isAllowed(identifier, req);

    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: result.reason || 'Too many requests',
          category: 'security',
          retryable: true,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

export function enhancedInputSanitizationMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!securityConfig.enableInputSanitization) {
    return next();
  }

  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, req);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, req);
    }

    // Validate Content-Type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type');
      if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
        logSecurityEvent('suspicious_content_type', { contentType, method: req.method }, req);
      }
    }

    next();
  } catch (error) {
    logSecurityEvent('input_sanitization_error', { error: error instanceof Error ? error.message : 'Unknown error' }, req);
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input data',
        category: 'validation',
        retryable: false,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

function sanitizeObject(obj: any, req?: Request): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj, req);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, req));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check for suspicious keys
    if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
      logSecurityEvent('prototype_pollution_attempt', { key, value }, req);
      continue;
    }

    sanitized[sanitizeValue(key, req)] = sanitizeObject(value, req);
  }

  return sanitized;
}

function sanitizeValue(value: any, req?: Request): any {
  if (typeof value !== 'string') {
    return value;
  }

  const original = value;

  // Remove script tags and javascript: URLs
  value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  value = value.replace(/javascript:/gi, '');
  value = value.replace(/on\w+\s*=/gi, '');

  // Check for SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(--|\||\/\*|\*\/)/g,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(value)) {
      logSecurityEvent('sql_injection_attempt', { original, sanitized: value }, req);
      break;
    }
  }

  // Check for XSS patterns
  const xssPatterns = [
    /<[^>]*>?/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+=/gi,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(original) && original !== value) {
      logSecurityEvent('xss_attempt', { original, sanitized: value }, req);
      break;
    }
  }

  return value.trim().slice(0, 1000); // Limit length
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!securityConfig.enableSecurityHeaders) {
    return next();
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP Header
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' ws: wss:",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  next();
}

export function auditLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!securityConfig.enableAuditLogging) {
    return next();
  }

  const start = Date.now();
  const originalSend = res.send;

  res.send = function(body) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Log security-relevant events
    if (statusCode >= 400) {
      logSecurityEvent('request_failed', {
        method: req.method,
        url: req.url,
        statusCode,
        duration,
        userAgent: req.get('User-Agent'),
      }, req);
    }

    // Log sensitive endpoints
    const sensitiveEndpoints = ['/api/auth/', '/api/system/', '/api/leads/'];
    if (sensitiveEndpoints.some(endpoint => req.url.includes(endpoint))) {
      logSecurityEvent('sensitive_endpoint_access', {
        method: req.method,
        url: req.url,
        statusCode,
        duration,
      }, req);
    }

    return originalSend.call(this, body);
  };

  next();
}

export function validateRequestSize(maxSize: string = securityConfig.maxRequestSize) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const maxBytes = parseSize(maxSize);

      if (size > maxBytes) {
        logSecurityEvent('request_size_exceeded', { 
          size, 
          maxSize: maxBytes,
          url: req.url,
        }, req);

        res.status(413).json({
          success: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: 'Request entity too large',
            category: 'validation',
            retryable: false,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    next();
  };
}

function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(value * units[unit]);
}

// Comprehensive security middleware stack
export function applySecurityMiddleware(app: any): void {
  // Rate limiting
  app.use('/api/auth/', enhancedRateLimitMiddleware('auth'));
  app.use('/api/webhook/', enhancedRateLimitMiddleware('webhook'));
  app.use('/api/', enhancedRateLimitMiddleware('api'));

  // Security headers
  app.use(securityHeadersMiddleware);

  // Request size validation
  app.use(validateRequestSize());

  // Input sanitization
  app.use(enhancedInputSanitizationMiddleware);

  // Audit logging
  app.use(auditLoggingMiddleware);
}

interface SecurityLogEntry {
  id: string;
  timestamp: string;
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent: string;
  url?: string;
  method?: string;
  details: any;
  fingerprint?: string;
}

class AuditLogger {
  private logs: SecurityLogEntry[] = [];
  private maxLogs = 10000;

  log(event: string, details: any, req?: Request, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const timestamp = new Date().toISOString();
    const ip = req?.ip || 'unknown';
    const userAgent = req?.get('User-Agent') || 'unknown';
    const fingerprint = this.generateFingerprint(event, ip, userAgent);

    const logEntry: SecurityLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      event,
      severity,
      ip,
      userAgent,
      url: req?.url,
      method: req?.method,
      details: this.stripPII(details),
      fingerprint,
    };

    this.logs.unshift(logEntry);

    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console logging with severity-based formatting
    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'log';
    console[logLevel](`[SECURITY:${severity.toUpperCase()}] ${timestamp} - ${event}`, {
      ip,
      userAgent,
      url: req?.url,
      method: req?.method,
      details: logEntry.details,
      fingerprint,
    });

    // Alert on critical events
    if (severity === 'critical') {
      this.handleCriticalEvent(logEntry);
    }
  }

  private generateFingerprint(event: string, ip: string, userAgent: string): string {
    const hash = createHash('sha256');
    hash.update(`${event}:${ip}:${userAgent}`);
    return hash.digest('hex').substring(0, 16);
  }

  private stripPII(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const piiFields = ['email', 'phone', 'ssn', 'address', 'firstName', 'lastName', 'fullName', 'password'];
    const cleaned = { ...data };

    for (const field of piiFields) {
      if (cleaned[field]) {
        cleaned[field] = '[REDACTED]';
      }
    }

    for (const [key, value] of Object.entries(cleaned)) {
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = this.stripPII(value);
      }
    }

    return cleaned;
  }

  private handleCriticalEvent(logEntry: SecurityLogEntry): void {
    // In production, this could trigger alerts, notifications, etc.
    console.error(`🚨 CRITICAL SECURITY EVENT: ${logEntry.event}`, logEntry);
  }

  getRecentLogs(limit: number = 100): SecurityLogEntry[] {
    return this.logs.slice(0, limit);
  }

  getLogsByFingerprint(fingerprint: string): SecurityLogEntry[] {
    return this.logs.filter(log => log.fingerprint === fingerprint);
  }

  getLogsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): SecurityLogEntry[] {
    return this.logs.filter(log => log.severity === severity);
  }
}

const auditLogger = new AuditLogger();

export function logSecurityEvent(
  event: string, 
  details: any, 
  req?: Request, 
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): void {
  auditLogger.log(event, details, req, severity);
}

export { auditLogger };