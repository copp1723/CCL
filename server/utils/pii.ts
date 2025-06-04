import { createHash } from 'crypto';

/**
 * Hash email addresses for PII protection
 */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Redact PII from data objects
 */
export function redactPII(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const redacted = { ...data };
  
  // Remove or hash sensitive fields
  if (redacted.email) {
    redacted.emailHash = hashEmail(redacted.email);
    delete redacted.email;
  }
  
  if (redacted.ssn) {
    redacted.ssn = '***-**-' + redacted.ssn.slice(-4);
  }
  
  if (redacted.creditCardNumber) {
    redacted.creditCardNumber = '**** **** **** ' + redacted.creditCardNumber.slice(-4);
  }
  
  if (redacted.phone && redacted.phone.length > 4) {
    redacted.phone = '***-***-' + redacted.phone.slice(-4);
  }
  
  return redacted;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (E.164 format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Format phone number to E.164
 */
export function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add + and country code if not present
  if (digits.length === 10) {
    return `+1${digits}`; // Assume US/Canada
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return phone; // Return as-is if can't format
}
