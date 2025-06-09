import { Response } from "express";
import { ErrorCode, getErrorDefinition, type ErrorDefinition } from "./error-codes";

// Re-export ErrorCode for other modules
export { ErrorCode };

export interface StandardError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    category: string;
    retryable: boolean;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

export interface StandardSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
}

export type ApiResponse<T = any> = StandardSuccess<T> | StandardError;

export class ApiError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: any;
  public retryable: boolean;
  public category: string;
  public logLevel: "error" | "warn" | "info";

  constructor(code: ErrorCode, message?: string, details?: any, statusCode?: number) {
    const errorDef = getErrorDefinition(code);
    super(message || errorDef.message);

    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode || errorDef.httpStatus;
    this.details = details;
    this.retryable = errorDef.retryable;
    this.category = errorDef.category;
    this.logLevel = errorDef.logLevel;
  }

  static fromErrorCode(code: ErrorCode, details?: any): ApiError {
    return new ApiError(code, undefined, details);
  }

  static validation(code: ErrorCode, field?: string, value?: any): ApiError {
    return new ApiError(code, undefined, { field, value });
  }

  static external(code: ErrorCode, service: string, originalError?: any): ApiError {
    return new ApiError(code, undefined, {
      service,
      originalError: originalError?.message || originalError,
    });
  }
}

export function createErrorResponse(
  error: ApiError | ErrorCode,
  details?: any,
  requestId?: string
): StandardError {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else {
    apiError = new ApiError(error, undefined, details);
  }

  return {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      category: apiError.category,
      retryable: apiError.retryable,
      details: apiError.details || details,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function createSuccessResponse<T>(data: T, requestId?: string): StandardSuccess<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function handleApiError(res: Response, error: any, requestId?: string): void {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error.name === "ValidationError") {
    apiError = new ApiError(ErrorCode.DATA_VALIDATION_FAILED, undefined, {
      originalError: error.message,
    });
  } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
    apiError = new ApiError(ErrorCode.SERVICE_UNAVAILABLE, undefined, { errorCode: error.code });
  } else {
    apiError = new ApiError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error.message || "An unexpected error occurred",
      process.env.NODE_ENV === "development" ? { stack: error.stack } : undefined
    );
  }

  // Log error with appropriate level
  const logMessage = `[${apiError.code}] ${apiError.message}`;
  const logContext = {
    code: apiError.code,
    category: apiError.category,
    retryable: apiError.retryable,
    statusCode: apiError.statusCode,
    details: apiError.details,
    requestId,
    timestamp: new Date().toISOString(),
  };

  switch (apiError.logLevel) {
    case "error":
      console.error(logMessage, logContext);
      break;
    case "warn":
      console.warn(logMessage, logContext);
      break;
    case "info":
      console.info(logMessage, logContext);
      break;
  }

  res.status(apiError.statusCode).json(createErrorResponse(apiError, undefined, requestId));
}

export function validateRequired(obj: any, fields: string[]): void {
  const missing = fields.filter(field => !obj[field]);
  if (missing.length > 0) {
    throw new ApiError(
      ErrorCode.REQUIRED_FIELD_MISSING,
      `Missing required fields: ${missing.join(", ")}`,
      { missingFields: missing }
    );
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw ApiError.validation(ErrorCode.INVALID_EMAIL_FORMAT, "email", email);
  }
}

export function validatePhoneNumber(phone: string): void {
  // E.164 format validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone)) {
    throw ApiError.validation(ErrorCode.INVALID_PHONE_FORMAT, "phone", phone);
  }
}

export function validateDataFormat(data: any, expectedType: string, fieldName?: string): void {
  if (expectedType === "array" && !Array.isArray(data)) {
    throw ApiError.validation(ErrorCode.INVALID_DATA_FORMAT, fieldName || "data", {
      expected: "array",
      actual: typeof data,
    });
  }
  if (expectedType === "object" && (typeof data !== "object" || data === null)) {
    throw ApiError.validation(ErrorCode.INVALID_DATA_FORMAT, fieldName || "data", {
      expected: "object",
      actual: typeof data,
    });
  }
}

export function validateFieldLength(value: string, fieldName: string, maxLength: number): void {
  if (value && value.length > maxLength) {
    throw ApiError.validation(ErrorCode.FIELD_LENGTH_EXCEEDED, fieldName, {
      actual: value.length,
      maximum: maxLength,
    });
  }
}

// Request ID generation utility
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Centralized async wrapper for route handlers
export function asyncHandler(fn: (req: any, res: any, next?: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    const requestId = generateRequestId();
    req.requestId = requestId;

    Promise.resolve(fn(req, res, next)).catch(error => {
      handleApiError(res, error, requestId);
    });
  };
}
