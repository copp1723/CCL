
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

interface AuthenticatedRequest extends Request {
  user?: User;
}

// In-memory store for demo (use Redis/database in production)
const users = new Map<string, User & { passwordHash: string; salt: string }>();
const sessions = new Map<string, { userId: string; expiresAt: Date }>();

// Initialize demo admin user
const adminSalt = randomBytes(32).toString('hex');
const adminPasswordHash = createHash('sha256').update('admin123' + adminSalt).digest('hex');
users.set('admin@completecarloans.com', {
  id: 'admin-1',
  email: 'admin@completecarloans.com',
  role: 'admin',
  permissions: ['read:all', 'write:all', 'admin:all'],
  passwordHash: adminPasswordHash,
  salt: adminSalt,
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

export function generateToken(user: User): string {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      permissions: user.permissions,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): User | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  } catch (error) {
    return null;
  }
}

export function authenticateUser(email: string, password: string): User | null {
  const user = users.get(email);
  if (!user) return null;

  const passwordHash = hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };
}

// Authentication middleware
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication token required',
        category: 'auth',
        retryable: false,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
        category: 'auth',
        retryable: false,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.user = user;
  next();
}

// Authorization middleware
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          category: 'auth',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this operation',
          category: 'auth',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

// Permission-based authorization
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          category: 'auth',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin:all')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required`,
          category: 'auth',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

// Login endpoint
export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required',
          category: 'validation',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = authenticateUser(email, password);
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          category: 'auth',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const token = generateToken(user);

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
        expiresIn: JWT_EXPIRES_IN,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed due to server error',
        category: 'system',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
