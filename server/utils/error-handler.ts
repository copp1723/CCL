import { Response } from "express";

export interface StandardError {
  success: false;
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}

export interface StandardSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = any> = StandardSuccess<T> | StandardError;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createErrorResponse(
  error: string,
  code: string,
  details?: any
): StandardError {
  return {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}

export function createSuccessResponse<T>(data: T): StandardSuccess<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

export function handleApiError(res: Response, error: any): void {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    res.status(error.statusCode).json(createErrorResponse(
      error.message,
      error.code,
      error.details
    ));
    return;
  }

  // Handle known error types
  if (error.name === 'ValidationError') {
    res.status(400).json(createErrorResponse(
      'Invalid request data',
      'VALIDATION_ERROR',
      error.message
    ));
    return;
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    res.status(503).json(createErrorResponse(
      'External service unavailable',
      'SERVICE_UNAVAILABLE',
      { errorCode: error.code }
    ));
    return;
  }

  // Default error response
  res.status(500).json(createErrorResponse(
    'Internal server error',
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development' ? error.message : undefined
  ));
}

export function validateRequired(obj: any, fields: string[]): void {
  const missing = fields.filter(field => !obj[field]);
  if (missing.length > 0) {
    throw new ApiError(
      'MISSING_FIELDS',
      `Missing required fields: ${missing.join(', ')}`,
      400,
      { missingFields: missing }
    );
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  // E.164 format validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}