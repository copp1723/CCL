import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import config from "../config/environment";
import { ApiError, ErrorCode } from "../utils/error-handler";

interface UserSession {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

class SessionManager {
  private sessions = new Map<string, UserSession>();
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.startCleanup();
  }

  createSession(user: any, req: Request): string {
    const sessionId = crypto.randomUUID();
    const session: UserSession = {
      id: sessionId,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: req.ip || "unknown",
      userAgent: req.get("User-Agent") || "unknown",
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  getSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if session is expired
    if (Date.now() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  revokeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
          this.sessions.delete(sessionId);
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  getActiveSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }
}

const sessionManager = new SessionManager();

export function generateToken(user: any, sessionId: string): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    userId: user.id || user.email,
    email: user.email,
    role: user.role,
    permissions: user.permissions || [],
    sessionId,
  };

  return jwt.sign(payload, config.get().JWT_SECRET, {
    expiresIn: "24h",
    issuer: "complete-car-loans",
    audience: "ccl-api",
  });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(ErrorCode.AUTHENTICATION_REQUIRED, "Authentication token required");
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const decoded = jwt.verify(token, config.get().JWT_SECRET, {
      issuer: "complete-car-loans",
      audience: "ccl-api",
    }) as JWTPayload;

    // Validate session
    const session = sessionManager.getSession(decoded.sessionId);
    if (!session) {
      throw new ApiError(ErrorCode.SESSION_EXPIRED, "Session expired or invalid");
    }

    // Security checks
    const currentIP = req.ip || "unknown";
    if (session.ipAddress !== currentIP && config.isProduction()) {
      console.warn(
        `IP mismatch for session ${decoded.sessionId}: ${session.ipAddress} vs ${currentIP}`
      );
      // In production, you might want to revoke the session
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid authentication token",
          category: "auth",
          retryable: false,
        },
      });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          category: error.category,
          retryable: error.retryable,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Authentication error",
          category: "server",
          retryable: false,
        },
      });
    }
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication required",
          category: "auth",
          retryable: false,
        },
      });
    }

    if (req.user.role === "admin" || req.user.permissions.includes(permission)) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Insufficient permissions",
        category: "auth",
        retryable: false,
      },
    });
  };
}

// Authentication routes
export function setupAuthRoutes(app: any): void {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Demo user validation
      if (email === "admin@completecarloans.com" && password === "admin123") {
        const user = {
          id: "admin-user",
          email: "admin@completecarloans.com",
          role: "admin",
          permissions: ["read:all", "write:all", "admin:all"],
        };

        const sessionId = sessionManager.createSession(user, req);
        const token = generateToken(user, sessionId);

        res.json({
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              permissions: user.permissions,
            },
          },
        });
      } else {
        res.status(401).json({
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
            category: "auth",
            retryable: false,
          },
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "AUTHENTICATION_ERROR",
          message: "Authentication failed",
          category: "server",
          retryable: false,
        },
      });
    }
  });

  app.post("/api/auth/logout", authMiddleware, (req: Request, res: Response) => {
    if (req.user?.sessionId) {
      sessionManager.revokeSession(req.user.sessionId);
    }

    res.json({
      success: true,
      data: { message: "Logged out successfully" },
    });
  });

  app.get(
    "/api/auth/sessions",
    authMiddleware,
    requirePermission("admin:all"),
    (req: Request, res: Response) => {
      const sessions = sessionManager.getActiveSessions();
      res.json({
        success: true,
        data: { sessions },
      });
    }
  );
}

export { sessionManager };
