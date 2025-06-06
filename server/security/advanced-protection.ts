import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config/environment';

// Advanced security features for enterprise deployment

interface SecurityEvent {
  type: 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_request' | 'unauthorized_access';
  ip: string;
  userAgent: string;
  timestamp: Date;
  details: any;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private suspiciousIPs = new Set<string>();
  private blockedIPs = new Set<string>();

  logEvent(event: SecurityEvent) {
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events.shift();
    }

    // Auto-block IPs with repeated violations
    const recentEvents = this.events.filter(e => 
      e.ip === event.ip && 
      Date.now() - e.timestamp.getTime() < 300000 // 5 minutes
    );

    if (recentEvents.length >= 10) {
      this.blockedIPs.add(event.ip);
      console.warn(`Security: Auto-blocked IP ${event.ip} for repeated violations`);
    }
  }

  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  getSecurityReport() {
    const now = Date.now();
    const recentEvents = this.events.filter(e => now - e.timestamp.getTime() < 3600000); // 1 hour

    return {
      totalEvents: this.events.length,
      recentEvents: recentEvents.length,
      blockedIPs: Array.from(this.blockedIPs),
      suspiciousIPs: Array.from(this.suspiciousIPs),
      eventsByType: recentEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const securityMonitor = new SecurityMonitor();

// IP blocking middleware
export function ipBlockingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (securityMonitor.isBlocked(clientIP)) {
      securityMonitor.logEvent({
        type: 'unauthorized_access',
        ip: clientIP,
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date(),
        details: { reason: 'blocked_ip', path: req.path }
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied',
          category: 'security',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

// Request signature validation for critical endpoints
export function requestSignatureValidation(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    
    if (!signature || !timestamp) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Request signature required',
          category: 'security',
          retryable: false
        }
      });
    }

    // Check timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    if (Math.abs(currentTime - requestTime) > 300000) { // 5 minutes
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIMESTAMP',
          message: 'Request timestamp invalid',
          category: 'security',
          retryable: false
        }
      });
    }

    // Validate signature
    const payload = JSON.stringify(req.body) + timestamp;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      securityMonitor.logEvent({
        type: 'suspicious_activity',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date(),
        details: { reason: 'invalid_signature', path: req.path }
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Request signature invalid',
          category: 'security',
          retryable: false
        }
      });
    }

    next();
  };
}

// Enhanced input validation
export function enhancedInputValidation() {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || 'unknown';
    
    // Check for common attack patterns
    const suspiciousPatterns = [
      /<script|javascript:|onload=|onerror=/i,
      /union\s+select|drop\s+table|insert\s+into/i,
      /\.\./,
      /exec\s*\(|eval\s*\(/i
    ];

    const checkValue = (value: any, path: string): boolean => {
      if (typeof value === 'string') {
        return suspiciousPatterns.some(pattern => pattern.test(value));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.entries(value).some(([key, val]) => 
          checkValue(val, `${path}.${key}`)
        );
      }
      return false;
    };

    // Check URL, headers, and body
    const urlSuspicious = suspiciousPatterns.some(pattern => pattern.test(req.url));
    const bodySuspicious = req.body && checkValue(req.body, 'body');
    const headersSuspicious = Object.values(req.headers).some(header => 
      typeof header === 'string' && suspiciousPatterns.some(pattern => pattern.test(header))
    );

    if (urlSuspicious || bodySuspicious || headersSuspicious) {
      securityMonitor.logEvent({
        type: 'suspicious_activity',
        ip: clientIP,
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date(),
        details: { 
          reason: 'malicious_pattern_detected',
          path: req.path,
          urlSuspicious,
          bodySuspicious,
          headersSuspicious
        }
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request data detected',
          category: 'security',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

// Sensitive data masking for logs
export function maskSensitiveData(data: any): any {
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'ssn', 'credit'];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  const masked = { ...data };
  Object.keys(masked).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  });

  return masked;
}