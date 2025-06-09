/**
 * Server-side data processing utilities
 */

import { ApiError, ErrorCode } from "./error-handler";

/**
 * Sanitize email for logging (hide domain for privacy)
 */
export function sanitizeEmailForLogging(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;

  return `${local}@...`;
}

/**
 * Sanitize phone number for logging
 */
export function sanitizePhoneForLogging(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 10) {
    return `***-***-${cleaned.slice(-4)}`;
  }
  return "***-***-****";
}

/**
 * Process CSV data with validation
 */
export function processCSVData(csvData: any[]): { valid: any[]; invalid: any[]; errors: string[] } {
  const valid = [];
  const invalid = [];
  const errors = [];

  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i];
    const rowErrors = [];

    // Validate required fields
    if (!row.email) rowErrors.push("Missing email");
    if (!row.firstName) rowErrors.push("Missing firstName");
    if (!row.lastName) rowErrors.push("Missing lastName");

    // Validate email format
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push("Invalid email format");
    }

    if (rowErrors.length === 0) {
      valid.push(row);
    } else {
      invalid.push({ ...row, rowIndex: i + 1 });
      errors.push(`Row ${i + 1}: ${rowErrors.join(", ")}`);
    }
  }

  return { valid, invalid, errors };
}

/**
 * Batch process data with size limits
 */
export function batchProcessData<T>(data: T[], batchSize: number = 100): T[][] {
  const batches = [];

  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new ApiError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    `Operation failed after ${maxRetries + 1} attempts`,
    { lastError: lastError?.message }
  );
}
