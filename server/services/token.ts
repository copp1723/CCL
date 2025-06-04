import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure return token
 * Used for email re-engagement with 24-hour TTL
 */
export function generateReturnToken(): string {
  // Generate 32 random bytes and convert to hex
  const token = randomBytes(32).toString('hex');
  return `rt_${token}`;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  const sessionBytes = randomBytes(16).toString('hex');
  return `sess_${sessionBytes}`;
}

/**
 * Generate email hash for PII protection
 * Uses SHA-256 with salt for consistent hashing
 */
export function generateEmailHash(email: string): string {
  const salt = process.env.EMAIL_HASH_SALT || 'ccl_default_salt_change_in_production';
  const hash = createHash('sha256');
  hash.update(email.toLowerCase().trim() + salt);
  return hash.digest('hex');
}

/**
 * Validate phone number format and convert to E.164
 */
export function validatePhoneNumber(phone: string): { valid: boolean; e164?: string; error?: string } {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check for valid US phone number (10 or 11 digits)
  if (digits.length === 10) {
    // Add US country code
    const e164 = `+1${digits}`;
    return { valid: true, e164 };
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // Already has country code
    const e164 = `+${digits}`;
    return { valid: true, e164 };
  } else {
    return { 
      valid: false, 
      error: 'Phone number must be 10 digits (US) or include country code' 
    };
  }
}

/**
 * Generate secure API key for external integrations
 */
export function generateApiKey(): string {
  const keyBytes = randomBytes(24).toString('base64url');
  return `ccl_${keyBytes}`;
}

/**
 * Create HMAC signature for webhook verification
 */
export function createWebhookSignature(payload: string, secret: string): string {
  const hmac = createHash('sha256');
  hmac.update(payload + secret);
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = createWebhookSignature(payload, secret);
  return signature === expectedSignature;
}

/**
 * Sanitize visitor data to remove PII
 */
export function sanitizeVisitorData(data: any): any {
  const sanitized = { ...data };
  
  // Remove or hash sensitive fields
  if (sanitized.email) {
    sanitized.emailHash = generateEmailHash(sanitized.email);
    delete sanitized.email;
  }
  
  if (sanitized.phone) {
    // Keep only last 4 digits for reference
    sanitized.phoneLastFour = sanitized.phone.slice(-4);
    delete sanitized.phone;
  }
  
  // Remove other PII fields
  delete sanitized.ssn;
  delete sanitized.dob;
  delete sanitized.address;
  delete sanitized.fullName;
  
  return sanitized;
}

/**
 * Generate tracking pixel URL for email opens
 */
export function generateTrackingPixelUrl(campaignId: number, token: string): string {
  const baseUrl = process.env.APP_URL || 'https://app.completecarloans.com';
  return `${baseUrl}/api/email/pixel/${campaignId}/${token}.gif`;
}

/**
 * Generate email click tracking URL
 */
export function generateClickTrackingUrl(originalUrl: string, campaignId: number, token: string): string {
  const baseUrl = process.env.APP_URL || 'https://app.completecarloans.com';
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${baseUrl}/api/email/click/${campaignId}/${token}?url=${encodedUrl}`;
}
