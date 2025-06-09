import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Enhanced input validation schemas
export const leadValidationSchema = z.object({
  email: z.string().email().max(254),
  status: z.enum(["new", "contacted", "qualified", "closed"]),
  leadData: z
    .object({})
    .passthrough()
    .refine(data => JSON.stringify(data).length <= 10000, "Lead data too large"),
});

export const emailCampaignSchema = z.object({
  campaignName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9\s\-_]+$/),
  recipients: z.array(z.string().email()).min(1).max(1000),
  template: z.string().optional(),
});

export const webhookLeadSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/)
      .optional(),
    firstName: z.string().max(50).optional(),
    lastName: z.string().max(50).optional(),
    vehicleInterest: z.string().max(100).optional(),
    creditScore: z.number().int().min(300).max(850).optional(),
    source: z.string().max(50).optional(),
  })
  .refine(data => data.email || data.phone, "Either email or phone is required");

export const searchParamsSchema = z.object({
  email: z.string().email().optional(),
  status: z.enum(["new", "contacted", "qualified", "closed"]).optional(),
  limit: z
    .string()
    .transform(val => parseInt(val))
    .refine(val => val > 0 && val <= 1000)
    .optional(),
  offset: z
    .string()
    .transform(val => parseInt(val))
    .refine(val => val >= 0)
    .optional(),
});

// Validation middleware factory
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            category: "validation",
            retryable: false,
            details: error.errors.map(err => ({
              field: err.path.join("."),
              message: err.message,
              received: err.input,
            })),
          },
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: "QUERY_VALIDATION_ERROR",
            message: "Invalid query parameters",
            category: "validation",
            retryable: false,
            details: error.errors.map(err => ({
              field: err.path.join("."),
              message: err.message,
              received: err.input,
            })),
          },
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  };
}

// Enhanced input sanitization
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }

    next();
  };
}

function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Prevent prototype pollution
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  return obj;
}

function sanitizeString(str: string): string {
  return str
    .replace(/[<>'"&]/g, "") // Remove potential XSS characters
    .replace(/\\/g, "") // Remove backslashes
    .replace(/\.\./g, "") // Remove path traversal
    .trim()
    .substring(0, 10000); // Limit string length
}

// Request size validation
export function validateRequestSize(maxSizeBytes: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get("content-length") || "0");

    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: {
          code: "REQUEST_TOO_LARGE",
          message: `Request size exceeds limit of ${maxSizeBytes} bytes`,
          category: "validation",
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

// Content type validation
export function validateContentType(allowedTypes: string[] = ["application/json"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get("content-type");

    if (req.method !== "GET" && req.method !== "DELETE") {
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          success: false,
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: `Content-Type must be one of: ${allowedTypes.join(", ")}`,
            category: "validation",
            retryable: false,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    next();
  };
}
