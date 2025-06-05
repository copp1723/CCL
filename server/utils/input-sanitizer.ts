// Input sanitization utilities to prevent security vulnerabilities
import { ApiError } from "./error-handler";
import { ErrorCode } from "./error-codes";

/**
 * Sanitizes campaign names to prevent path traversal attacks
 */
export function sanitizeCampaignName(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new ApiError(ErrorCode.INVALID_DATA_FORMAT, 'Campaign name must be a valid string');
  }

  // Remove path traversal patterns
  const sanitized = input
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/[<>:"|?*]/g, '')
    .trim();

  // Check for remaining suspicious patterns
  if (sanitized.includes('etc') || sanitized.includes('passwd') || sanitized.includes('config')) {
    throw new ApiError(ErrorCode.VALIDATION_001, 'Campaign name contains invalid characters');
  }

  // Ensure minimum length
  if (sanitized.length < 1) {
    throw new ApiError(ErrorCode.REQUIRED_FIELD_MISSING, 'Campaign name cannot be empty after sanitization');
  }

  // Ensure maximum length
  if (sanitized.length > 100) {
    throw new ApiError(ErrorCode.FIELD_LENGTH_EXCEEDED, 'Campaign name too long');
  }

  return sanitized;
}

/**
 * Sanitizes email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new ApiError(ErrorCode.INVALID_EMAIL_FORMAT, 'Email must be a valid string');
  }

  const sanitized = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new ApiError(ErrorCode.INVALID_EMAIL_FORMAT, 'Invalid email format');
  }

  return sanitized;
}

/**
 * Sanitizes general text input
 */
export function sanitizeText(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();

  if (sanitized.length > maxLength) {
    throw new ApiError(ErrorCode.FIELD_LENGTH_EXCEEDED, `Text exceeds maximum length of ${maxLength} characters`);
  }

  return sanitized;
}

/**
 * Validates and sanitizes phone numbers
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new ApiError(ErrorCode.INVALID_PHONE_FORMAT, 'Phone number must be a valid string');
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Check for valid length (10-15 digits)
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    throw new ApiError(ErrorCode.INVALID_PHONE_FORMAT, 'Phone number must be 10-15 digits');
  }

  return digitsOnly;
}

/**
 * Sanitizes JSON data to prevent injection attacks
 */
export function sanitizeJsonData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeText(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJsonData(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const sanitizedKey = sanitizeText(key, 100);
      sanitized[sanitizedKey] = sanitizeJsonData(value);
    }
    return sanitized;
  }
  
  return data;
}