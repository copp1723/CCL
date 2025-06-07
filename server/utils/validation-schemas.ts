/**
 * Input validation schemas for data security and integrity
 * Uses Joi for comprehensive validation with security-focused rules
 */

import Joi from 'joi';

// Lead validation schema
export const leadSchema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'org', 'edu', 'gov'] } })
    .required()
    .max(254) // RFC 5321 limit
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
      'string.max': 'Email address is too long'
    }),
    
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/) // E.164 format
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be in valid international format'
    }),
    
  status: Joi.string()
    .valid('new', 'contacted', 'qualified', 'closed')
    .default('new'),
    
  leadData: Joi.object({
    vehicleInterest: Joi.string().max(100).optional(),
    creditScore: Joi.number().min(300).max(850).optional(),
    annualIncome: Joi.number().min(0).max(10000000).optional(),
    loanAmount: Joi.number().min(1000).max(500000).optional(),
    firstName: Joi.string().max(50).pattern(/^[a-zA-Z\s'-]+$/).optional(),
    lastName: Joi.string().max(50).pattern(/^[a-zA-Z\s'-]+$/).optional(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional()
  }).optional()
});

// Activity validation schema
export const activitySchema = Joi.object({
  type: Joi.string()
    .valid('lead_created', 'email_sent', 'chat_started', 'visitor_identified', 'system_event')
    .required(),
    
  description: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.min': 'Description cannot be empty',
      'string.max': 'Description is too long (max 500 characters)'
    }),
    
  agentType: Joi.string()
    .valid('visitor_identifier', 'chat', 'email_reengagement', 'lead_packaging')
    .optional(),
    
  metadata: Joi.object().optional()
});

// Visitor validation schema
export const visitorSchema = Joi.object({
  sessionId: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .max(64)
    .optional(),
    
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional(),
    
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .max(254)
    .optional(),
    
  ipAddress: Joi.string()
    .ip({ version: ['ipv4', 'ipv6'] })
    .optional(),
    
  userAgent: Joi.string()
    .max(500)
    .optional(),
    
  metadata: Joi.object().optional()
});

// Chat message validation schema
export const chatMessageSchema = Joi.object({
  type: Joi.string()
    .valid('user', 'agent')
    .required(),
    
  content: Joi.string()
    .min(1)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message is too long (max 2000 characters)'
    }),
    
  metadata: Joi.object().optional()
});

// Email template validation schema
export const emailTemplateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .required(),
    
  subject: Joi.string()
    .min(1)
    .max(200)
    .required(),
    
  content: Joi.string()
    .min(1)
    .max(50000)
    .required(),
    
  variables: Joi.array()
    .items(Joi.string().max(50))
    .optional(),
    
  category: Joi.string()
    .valid('welcome', 'follow-up', 'reengagement', 'promotional')
    .required(),
    
  isActive: Joi.boolean()
    .default(true)
});

// Validation helper functions
export class ValidationError extends Error {
  public details: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validateInput<T>(schema: Joi.ObjectSchema, data: any): T {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  
  if (error) {
    throw new ValidationError(
      'Validation failed',
      error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    );
  }
  
  return value;
}

// Sanitization helpers
export function sanitizeString(input: string): string {
  if (!input) return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

export function sanitizeEmail(email: string): string {
  if (!email) return email;
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w@.-]/g, ''); // Keep only valid email characters
}
