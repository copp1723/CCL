
import { Request, Response, NextFunction } from 'express';

export interface ErrorContext {
  userId?: string;
  agentType?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, context?: ErrorContext) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ErrorLogger {
  private static logError(error: Error, context?: ErrorContext) {
    const timestamp = new Date().toISOString();
    const errorDetails = {
      timestamp,
      message: error.message,
      stack: error.stack,
      context,
      type: error.constructor.name
    };

    // Console logging with structured format
    console.error(`[ERROR] ${timestamp}:`, JSON.stringify(errorDetails, null, 2));
  }

  public static logAndThrow(message: string, statusCode: number = 500, context?: ErrorContext): never {
    const error = new AppError(message, statusCode, true, context);
    this.logError(error, context);
    throw error;
  }

  public static logWarning(message: string, context?: ErrorContext) {
    const timestamp = new Date().toISOString();
    console.warn(`[WARNING] ${timestamp}: ${message}`, context ? JSON.stringify(context) : '');
  }

  public static logInfo(message: string, context?: ErrorContext) {
    const timestamp = new Date().toISOString();
    console.info(`[INFO] ${timestamp}: ${message}`, context ? JSON.stringify(context) : '');
  }
}

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }

  // Log all errors
  ErrorLogger.logError(error, {
    operation: `${req.method} ${req.path}`,
    userId: req.headers['user-id'] as string,
    metadata: { body: req.body, query: req.query }
  });

  // Don't expose internal errors to client
  if (!isOperational) {
    message = 'Something went wrong. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
