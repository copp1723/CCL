
/**
 * Client-side data validation utilities
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  
  return {
    isValid,
    errors: isValid ? [] : ['Invalid email format']
  };
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): ValidationResult {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  const isValid = phoneRegex.test(phone);
  
  return {
    isValid,
    errors: isValid ? [] : ['Invalid phone number format']
  };
}

/**
 * Validate required fields
 */
export function validateRequired(obj: Record<string, any>, fields: string[]): ValidationResult {
  const missingFields = fields.filter(field => !obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === ''));
  
  return {
    isValid: missingFields.length === 0,
    errors: missingFields.length > 0 ? [`Missing required fields: ${missingFields.join(', ')}`] : []
  };
}

/**
 * Validate field length
 */
export function validateLength(value: string, fieldName: string, maxLength: number): ValidationResult {
  const isValid = !value || value.length <= maxLength;
  
  return {
    isValid,
    errors: isValid ? [] : [`${fieldName} exceeds maximum length of ${maxLength} characters`]
  };
}

/**
 * Combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(result => result.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}
