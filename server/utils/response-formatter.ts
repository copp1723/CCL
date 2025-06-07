/**
 * Enhanced API response formatter with comprehensive error handling
 * Provides standardized responses with security and monitoring features
 */

import { Response } from 'express';

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
  performance?: {
    responseTime: number;
    cacheHit?: boolean;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    category: 'validation' | 'auth' | 'client' | 'server' | 'rate_limit' | 'security';
    retryable: boolean;
    details?: any;
    correlationId?: string;
  };
  timestamp: string;
  requestId?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Error logging interface
interface ErrorLogger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
}

// Simple console logger (replace with proper logger in production)
const logger: ErrorLogger = {
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta),
  info: (message: string, meta?: any) => console.info(`[INFO] ${message}`, meta)
};

/**
 * Send standardized success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  requestId?: string
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };

  res.status(statusCode).json(response);
}

/**
 * Send standardized error response
 */
export function sendError(
  res: Response,
  error: {
    code: string;
    message: string;
    category: 'validation' | 'auth' | 'client' | 'server' | 'rate_limit' | 'security';
    retryable: boolean;
    details?: any;
  },
  statusCode: number = 500,
  requestId?: string
): void {
  const response: ApiErrorResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };

  // Log errors for monitoring
  if (statusCode >= 500) {
    logger.error(`Server Error ${statusCode}: ${error.code}`, {
      message: error.message,
      requestId,
      category: error.category
    });
  }

  res.status(statusCode).json(response);
}

/**
 * Send validation error response
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: any,
  requestId?: string
): void {
  sendError(res, {
    code: 'VALIDATION_ERROR',
    message,
    category: 'validation',
    retryable: false,
    details
  }, 400, requestId);
}

/**
 * Send not found error response
 */
export function sendNotFound(
  res: Response,
  resource: string,
  requestId?: string
): void {
  sendError(res, {
    code: 'RESOURCE_NOT_FOUND',
    message: `${resource} not found`,
    category: 'client',
    retryable: false
  }, 404, requestId);
}

/**
 * Send unauthorized error response
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized access',
  requestId?: string
): void {
  sendError(res, {
    code: 'UNAUTHORIZED',
    message,
    category: 'auth',
    retryable: false
  }, 401, requestId);
}

/**
 * Send rate limit error response
 */
export function sendRateLimit(
  res: Response,
  message: string = 'Rate limit exceeded',
  requestId?: string
): void {
  sendError(res, {
    code: 'RATE_LIMIT_EXCEEDED',
    message,
    category: 'rate_limit',
    retryable: true
  }, 429, requestId);
}

/**
 * Send server error response
 */
export function sendServerError(
  res: Response,
  message: string = 'Internal server error',
  requestId?: string
): void {
  sendError(res, {
    code: 'INTERNAL_ERROR',
    message,
    category: 'server',
    retryable: true
  }, 500, requestId);
}
