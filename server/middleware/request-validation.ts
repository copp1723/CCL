
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logSecurityEvent } from './security-enhanced';

interface ValidationSchema {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}

// Common validation schemas
const emailSchema = z.string().email().max(254);
const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/);
const uuidSchema = z.string().uuid();
const sanitizedStringSchema = z.string().max(1000).regex(/^[a-zA-Z0-9\s\-_.@]+$/);

// Request validation schemas
const leadCreationSchema = z.object({
  email: emailSchema,
  status: z.enum(['new', 'contacted', 'qualified', 'closed']),
  leadData: z.object({
    firstName: sanitizedStringSchema.optional(),
    lastName: sanitizedStringSchema.optional(),
    phone: phoneSchema.optional(),
    source: sanitizedStringSchema.optional(),
  }),
});

const chatMessageSchema = z.object({
  sessionId: uuidSchema,
  message: z.string().min(1).max(2000),
  type: z.enum(['user', 'agent']).optional(),
});

const emailCampaignSchema = z.object({
  visitorId: z.number().positive(),
  campaignType: z.enum(['reengagement', 'followup', 'promotional']),
  personalizedContent: z.boolean().optional(),
});

// Common query parameter schemas
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n <= 100).optional(),
  sortBy: sanitizedStringSchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timeZone: z.string().max(50).optional(),
});

// Header validation schema
const securityHeadersSchema = z.object({
  'content-type': z.string().optional(),
  'user-agent': z.string().max(500).optional(),
  'accept': z.string().max(200).optional(),
  'accept-language': z.string().max(100).optional(),
  'authorization': z.string().max(1000).optional(),
});

export function validateRequest(schemas: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schemas.body && req.body) {
        const bodyResult = schemas.body.safeParse(req.body);
        if (!bodyResult.success) {
          logSecurityEvent('validation_failed', {
            type: 'body',
            errors: bodyResult.error.errors,
            url: req.url,
          }, req, 'medium');
          
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              category: 'validation',
              details: bodyResult.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
              })),
              retryable: false,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        req.body = bodyResult.data;
      }

      // Validate query parameters
      if (schemas.query && req.query) {
        const queryResult = schemas.query.safeParse(req.query);
        if (!queryResult.success) {
          logSecurityEvent('validation_failed', {
            type: 'query',
            errors: queryResult.error.errors,
            url: req.url,
          }, req, 'medium');
          
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              category: 'validation',
              details: queryResult.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
              })),
              retryable: false,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        req.query = queryResult.data;
      }

      // Validate URL parameters
      if (schemas.params && req.params) {
        const paramsResult = schemas.params.safeParse(req.params);
        if (!paramsResult.success) {
          logSecurityEvent('validation_failed', {
            type: 'params',
            errors: paramsResult.error.errors,
            url: req.url,
          }, req, 'medium');
          
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid URL parameters',
              category: 'validation',
              details: paramsResult.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
              })),
              retryable: false,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
        req.params = paramsResult.data;
      }

      // Validate headers
      if (schemas.headers) {
        const headersResult = schemas.headers.safeParse(req.headers);
        if (!headersResult.success) {
          logSecurityEvent('validation_failed', {
            type: 'headers',
            errors: headersResult.error.errors,
            url: req.url,
          }, req, 'high');
          
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request headers',
              category: 'validation',
              retryable: false,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      next();
    } catch (error) {
      logSecurityEvent('validation_error', {
        error: error instanceof Error ? error.message : 'Unknown validation error',
        url: req.url,
      }, req, 'high');
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Request validation failed',
          category: 'server',
          retryable: true,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Pre-configured validation middleware for common endpoints
export const validateLeadCreation = validateRequest({
  body: leadCreationSchema,
  query: paginationSchema,
});

export const validateChatMessage = validateRequest({
  body: chatMessageSchema,
});

export const validateEmailCampaign = validateRequest({
  body: emailCampaignSchema,
});

export const validatePagination = validateRequest({
  query: paginationSchema,
});

export const validateDateRange = validateRequest({
  query: dateRangeSchema,
});

export const validateSecurityHeaders = validateRequest({
  headers: securityHeadersSchema,
});

// Enhanced input sanitization with better logging
export function enhancedSanitizationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const originalBody = JSON.stringify(req.body);
    const originalQuery = JSON.stringify(req.query);

    // Apply sanitization
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, req);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, req);
    }

    // Log if significant changes were made
    const sanitizedBody = JSON.stringify(req.body);
    const sanitizedQuery = JSON.stringify(req.query);

    if (originalBody !== sanitizedBody || originalQuery !== sanitizedQuery) {
      logSecurityEvent('input_sanitized', {
        bodyChanged: originalBody !== sanitizedBody,
        queryChanged: originalQuery !== sanitizedQuery,
        url: req.url,
      }, req, 'low');
    }

    next();
  } catch (error) {
    logSecurityEvent('sanitization_error', {
      error: error instanceof Error ? error.message : 'Unknown sanitization error',
    }, req, 'high');
    
    res.status(400).json({
      success: false,
      error: {
        code: 'SANITIZATION_ERROR',
        message: 'Request processing failed',
        category: 'validation',
        retryable: false,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

function sanitizeObject(obj: any, req?: Request): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj, req);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, req));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
      logSecurityEvent('prototype_pollution_attempt', { key, value }, req, 'critical');
      continue;
    }

    sanitized[sanitizeValue(key, req)] = sanitizeObject(value, req);
  }

  return sanitized;
}

function sanitizeValue(value: any, req?: Request): any {
  if (typeof value !== 'string') {
    return value;
  }

  const original = value;
  
  // Remove dangerous patterns
  value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  value = value.replace(/javascript:/gi, '');
  value = value.replace(/on\w+\s*=/gi, '');
  value = value.replace(/data:/gi, '');
  
  // SQL injection prevention
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(--|\||\/\*|\*\/)/g,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(value)) {
      logSecurityEvent('sql_injection_attempt', { original, sanitized: value }, req, 'critical');
      break;
    }
  }

  return value.trim().slice(0, 1000);
}

export { emailSchema, phoneSchema, uuidSchema, sanitizedStringSchema };
