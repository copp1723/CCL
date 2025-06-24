import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

interface ApiErrorProps {
  statusCode?: number;
  message?: string;
  errorCode?: string; // Internal error code for client-side handling
  details?: any; // Additional details for debugging or client use
}

export class ApiError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: any;

  constructor({
    message = "An unexpected error occurred",
    statusCode = 500,
    errorCode,
    details,
  }: ApiErrorProps = {}) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype); // Ensure instanceof works
  }
}

export const globalErrorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction // Express requires next for error middleware signature
): void => {
  const isProduction = process.env.NODE_ENV === "production";
  let statusCode: number;
  let message: string;
  let errorCode: string | undefined;
  let details: any;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode;
    details = err.details;
    logger.warn(
      {
        err,
        path: req.path,
        method: req.method,
        statusCode,
        errorCode,
        details,
      },
      `API Error: ${message}`
    );
  } else {
    // Generic error
    statusCode = 500;
    message = isProduction
      ? "Internal Server Error"
      : err.message || "An unexpected error occurred";
    logger.error(
      {
        err,
        path: req.path,
        method: req.method,
        statusCode,
      },
      `Unhandled Server Error: ${err.message}`
    );
  }

  // Prevent sending response if headers already sent (e.g. by a stream error)
  if (res.headersSent) {
    // Delegate to default Express error handler if headers are already sent
    // by calling next(err) but this is not possible here as we are in the error handler.
    // So, we simply log and do nothing more.
    logger.error(
      { err, path: req.path, method: req.method },
      "Headers already sent, cannot send error response."
    );
    return;
  }

  const errorResponse: {
    success: boolean;
    error: { message: string; code?: string; details?: any };
  } = {
    success: false,
    error: {
      message,
    },
  };

  if (errorCode) {
    errorResponse.error.code = errorCode;
  }

  if (!isProduction && details) {
    errorResponse.error.details = details; // Only include details in non-production
  }
  if (!isProduction && !(err instanceof ApiError) && err.stack) {
    errorResponse.error.details = { stack: err.stack }; // Include stack for generic errors in dev
  }

  res.status(statusCode).json(errorResponse);
};

// Helper function to easily throw API errors from route handlers
export const throwApiError = (props: ApiErrorProps): never => {
  throw new ApiError(props);
};

// Async wrapper to catch errors in async route handlers and pass to Express error handling
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
