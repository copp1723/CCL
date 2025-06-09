import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import config from "../config/environment";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface SecurityEvent {
  type: "suspicious_activity" | "rate_limit_exceeded" | "invalid_request" | "unauthorized_access";
  ip: string;
  userAgent: string;
  timestamp: Date;
  details: any;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private blockedIPs = new Set<string>();
  private rateLimitStore: RateLimitStore = {};
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxRequests = 100;

  private cleanup() {
    const now = Date.now();
    Object.keys(this.rateLimitStore).forEach(key => {
      if (this.rateLimitStore[key].resetTime < now) {
        delete this.rateLimitStore[key];
      }
    });
  }

  logEvent(event: SecurityEvent) {
    this.events.push(event);
    if (this.events.length > 1000) {
      this.events.shift();
    }

    const recentEvents = this.events.filter(
      e => e.ip === event.ip && Date.now() - e.timestamp.getTime() < 300000 // 5 minutes
    );

    if (recentEvents.length >= 10) {
      this.blockedIPs.add(event.ip);
      console.warn(`Security: Auto-blocked IP ${event.ip} for repeated violations`);
    }
  }

  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  rateLimitMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || "unknown";
      const now = Date.now();

      if (!this.rateLimitStore[key] || this.rateLimitStore[key].resetTime < now) {
        this.rateLimitStore[key] = {
          count: 1,
          resetTime: now + this.windowMs,
        };
      } else {
        this.rateLimitStore[key].count++;
      }

      const remaining = Math.max(0, this.maxRequests - this.rateLimitStore[key].count);

      res.set({
        "X-RateLimit-Limit": this.maxRequests.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
      });

      if (this.rateLimitStore[key].count > this.maxRequests) {
        this.logEvent({
          type: "rate_limit_exceeded",
          ip: key,
          userAgent: req.get("User-Agent") || "",
          timestamp: new Date(),
          details: { path: req.path },
        });

        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
            category: "rate_limit",
            retryable: true,
          },
        });
      }

      this.cleanup();
      next();
    };
  }

  ipBlockingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || "unknown";

      if (this.isBlocked(clientIP)) {
        return res.status(403).json({
          success: false,
          error: {
            code: "IP_BLOCKED",
            message: "Access denied",
            category: "security",
            retryable: false,
          },
        });
      }

      next();
    };
  }

  inputValidationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const suspiciousPatterns = [
        /<script|javascript:|onload=|onerror=/i,
        /union\s+select|drop\s+table|insert\s+into/i,
        /\.\./,
        /exec\s*\(|eval\s*\(/i,
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === "string") {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === "object" && value !== null) {
          return Object.values(value).some(val => checkValue(val));
        }
        return false;
      };

      const urlSuspicious = suspiciousPatterns.some(pattern => pattern.test(req.url));
      const bodySuspicious = req.body && checkValue(req.body);

      if (urlSuspicious || bodySuspicious) {
        this.logEvent({
          type: "suspicious_activity",
          ip: req.ip || "unknown",
          userAgent: req.get("User-Agent") || "",
          timestamp: new Date(),
          details: { reason: "malicious_pattern_detected", path: req.path },
        });

        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Invalid request data",
            category: "security",
            retryable: false,
          },
        });
      }

      next();
    };
  }

  securityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });

      const corsOrigin = config.get().CORS_ORIGIN;
      if (corsOrigin !== "*") {
        res.set("Access-Control-Allow-Origin", corsOrigin);
      }

      next();
    };
  }

  getSecurityReport() {
    return {
      totalEvents: this.events.length,
      blockedIPs: Array.from(this.blockedIPs),
      recentEvents: this.events.filter(e => Date.now() - e.timestamp.getTime() < 3600000).length,
    };
  }
}

export const securityMonitor = new SecurityMonitor();

export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip,
      };

      console.log(JSON.stringify(logEntry));

      if (res.statusCode >= 400) {
        console.error(
          `Error response: ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`
        );
      }

      if (duration > 1000) {
        console.warn(`Slow request: ${req.method} ${req.url} - ${duration}ms`);
      }
    });

    next();
  };
}

export function errorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId || "unknown";

    console.error(`Error [${requestId}]:`, {
      message: err.message,
      stack: config.isDevelopment() ? err.stack : undefined,
      url: req.url,
      method: req.method,
      ip: req.ip,
    });

    if (res.headersSent) {
      return next(err);
    }

    const statusCode = err.status || 500;
    const message = config.isDevelopment() ? err.message : "Internal server error";

    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || "INTERNAL_ERROR",
        message,
        category: "server",
        retryable: statusCode >= 500,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  };
}
