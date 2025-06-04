import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * Generate a secure return token for email campaigns
 */
export function generateReturnToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(expiry: Date): boolean {
  return new Date() > expiry;
}

/**
 * Generate token expiry date (24 hours from now)
 */
export function generateTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Securely compare tokens
 */
export function compareTokens(token1: string, token2: string): boolean {
  if (token1.length !== token2.length) return false;
  
  const buf1 = Buffer.from(token1, 'utf8');
  const buf2 = Buffer.from(token2, 'utf8');
  
  return timingSafeEqual(buf1, buf2);
}
