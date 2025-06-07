` tags. I will pay close attention to the authentication logic and ensure the updated version is secure and functional, while adhering to all the provided constraints.

```
<replit_final_file>
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/environment';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Access token is required',
        category: 'auth',
        retryable: false
      }
    });
  }

  try {
    const jwtSecret = config.get().JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        category: 'auth',
        retryable: false
      }
    });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          category: 'auth',
          retryable: false
        }
      });
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          category: 'auth',
          retryable: false
        }
      });
    }

    next();
  };
}

// Simple login endpoint for testing
export function createAuthRoutes() {
  const router = require('express').Router();

  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Simple hardcoded auth for development
    if (email === 'admin@completecarloans.com' && password === 'admin123') {
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: '1',
        email,
        role: 'admin'
      };

      const token = jwt.sign(payload, config.get().JWT_SECRET!, { expiresIn: '24h' });

      return res.json({
        success: true,
        data: { token, user: payload }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        category: 'auth',
        retryable: false
      }
    });
  });

  return router;
}