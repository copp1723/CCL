import crypto from 'crypto';

export function generateSessionId(): string {
  return `sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateEmailHash(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

export function generateReturnToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateVisitorId(): string {
  return `visitor_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}