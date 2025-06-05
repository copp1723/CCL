/**
 * External API Integration Services
 * Production-ready integrations for FlexPath credit checks and Mailgun email delivery
 */

export interface FlexPathCreditRequest {
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FlexPathCreditResponse {
  success: boolean;
  approved: boolean;
  creditScore?: number;
  riskTier: 'prime' | 'near-prime' | 'sub-prime' | 'deep-sub-prime';
  maxLoanAmount?: number;
  estimatedRate?: number;
  externalId: string;
  reasons?: string[];
  error?: string;
}

export interface MailgunEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  customData?: Record<string, any>;
}

export interface MailgunEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class FlexPathService {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number = 10000; // 10 second timeout

  constructor() {
    this.apiKey = process.env.FLEXPATH_API_KEY || '';
    this.baseUrl = process.env.FLEXPATH_BASE_URL || 'https://sandbox.flexpath.com/api/v1';

    if (!this.apiKey) {
      console.warn('FlexPath API key not configured. Credit checks will use simulation mode.');
    }
  }

  async performCreditCheck(request: FlexPathCreditRequest): Promise<FlexPathCreditResponse> {
    if (!this.apiKey) {
      return this.simulateCreditCheck(request);
    }

    try {
      const response = await fetch(`${this.baseUrl}/credit-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CCL-Agent-System/1.0'
        },
        body: JSON.stringify({
          phone: request.phoneNumber,
          first_name: request.firstName,
          last_name: request.lastName,
          email: request.email,
          ip_address: request.ipAddress,
          user_agent: request.userAgent,
          soft_pull: true, // For pre-qualification
          purpose: 'auto_loan',
          loan_amount_requested: 25000 // Default amount
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`FlexPath API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        approved: data.approved,
        creditScore: data.credit_score,
        riskTier: this.mapRiskTier(data.credit_score),
        maxLoanAmount: data.max_loan_amount,
        estimatedRate: data.estimated_rate,
        externalId: data.reference_id,
        reasons: data.decline_reasons || []
      };

    } catch (error) {
      console.error('FlexPath credit check failed:', error);

      return {
        success: false,
        approved: false,
        riskTier: 'deep-sub-prime',
        externalId: `sim_${Date.now()}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private simulateCreditCheck(request: FlexPathCreditRequest): Promise<FlexPathCreditResponse> {
    // Deterministic simulation based on phone number for consistent testing
    const phoneHash = this.hashString(request.phoneNumber);
    const scoreVariation = phoneHash % 300;
    const baseScore = 580 + scoreVariation;

    const approved = baseScore >= 620;
    const riskTier = this.mapRiskTier(baseScore);

    return Promise.resolve({
      success: true,
      approved,
      creditScore: baseScore,
      riskTier,
      maxLoanAmount: approved ? Math.min(50000, baseScore * 100) : undefined,
      estimatedRate: approved ? Math.max(3.5, 15 - (baseScore - 620) / 20) : undefined,
      externalId: `sim_${Date.now()}_${phoneHash}`,
      reasons: !approved ? ['Insufficient credit history', 'Income verification required'] : []
    });
  }

  private mapRiskTier(creditScore: number): 'prime' | 'near-prime' | 'sub-prime' | 'deep-sub-prime' {
    if (creditScore >= 740) return 'prime';
    if (creditScore >= 670) return 'near-prime';
    if (creditScore >= 580) return 'sub-prime';
    return 'deep-sub-prime';
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export class MailgunService {
  private apiKey: string;
  private domain: string;
  private baseUrl: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.MAILGUN_API_KEY || '';
    // Clean domain by removing any path or protocol
    const rawDomain = process.env.MAILGUN_DOMAIN || '';
    this.domain = rawDomain.replace(/^https?:\/\//, '').split('/')[0];
    this.baseUrl = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3';
    this.fromEmail = process.env.MAILGUN_FROM_EMAIL || 'noreply@completecarloan.com';

    console.log(`Mailgun configured - Domain: ${this.domain}, API Key length: ${this.apiKey.length}`);

    if (!this.apiKey || !this.domain) {
      console.warn('Mailgun credentials not configured. Emails will use simulation mode.');
    }
  }

  async sendEmail(request: MailgunEmailRequest): Promise<MailgunEmailResponse> {
    if (!this.apiKey || !this.domain) {
      return this.simulateEmailSend(request);
    }

    try {
      const formData = new FormData();
      formData.append('from', request.from || this.fromEmail);
      formData.append('to', request.to);
      formData.append('subject', request.subject);
      formData.append('html', request.html);

      if (request.text) {
        formData.append('text', request.text);
      }

      if (request.tags) {
        request.tags.forEach(tag => formData.append('o:tag', tag));
      }

      if (request.customData) {
        Object.entries(request.customData).forEach(([key, value]) => {
          formData.append(`v:${key}`, String(value));
        });
      }

      const apiUrl = `${this.baseUrl}/${this.domain}/messages`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`
        },
        body: formData,
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText);
        
        // Handle sandbox domain authorization requirement
        if (errorData.message && errorData.message.includes('authorized recipients')) {
          return {
            success: false,
            error: `Sandbox domain requires authorized recipients. Please add ${request.to} to authorized recipients in your Mailgun dashboard at: https://app.mailgun.com/mg/sending/${this.domain.split('.')[0]}/settings`
          };
        }
        
        throw new Error(`Mailgun API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        messageId: data.id
      };

    } catch (error) {
      console.error('Mailgun email send failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private simulateEmailSend(request: MailgunEmailRequest): Promise<MailgunEmailResponse> {
    // Simulate email delivery with realistic timing
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 95% delivery success rate
        const success = Math.random() > 0.05;

        resolve({
          success,
          messageId: success ? `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined,
          error: !success ? 'Simulated delivery failure' : undefined
        });
      }, 100); // Simulate network delay
    });
  }

  validateEmail(email: string): { valid: boolean; reason?: string } {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Invalid email format' };
    }

    // Check for common disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com'
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(domain)) {
      return { valid: false, reason: 'Disposable email domain not allowed' };
    }

    return { valid: true };
  }
}

export class PIIProtectionService {
  private ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g;
  private phonePattern = /\b\d{3}-?\d{3}-?\d{4}\b/g;
  private creditCardPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  private dobPattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;

  sanitizeContent(content: string): { sanitized: string; piiDetected: boolean; violations: string[] } {
    let sanitized = content;
    const violations: string[] = [];
    let piiDetected = false;

    // Redact SSN
    if (this.ssnPattern.test(content)) {
      sanitized = sanitized.replace(this.ssnPattern, 'XXX-XX-XXXX');
      violations.push('SSN detected and redacted');
      piiDetected = true;
    }

    // Redact credit card numbers
    if (this.creditCardPattern.test(content)) {
      sanitized = sanitized.replace(this.creditCardPattern, 'XXXX-XXXX-XXXX-XXXX');
      violations.push('Credit card number detected and redacted');
      piiDetected = true;
    }

    // Redact dates of birth
    if (this.dobPattern.test(content)) {
      sanitized = sanitized.replace(this.dobPattern, 'XX/XX/XXXX');
      violations.push('Date of birth detected and redacted');
      piiDetected = true;
    }

    return { sanitized, piiDetected, violations };
  }

  validatePhoneNumber(phone: string): { valid: boolean; formatted?: string; error?: string } {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Check for valid US phone number length
    if (digits.length === 10) {
      const formatted = `+1${digits}`;
      return { valid: true, formatted };
    } else if (digits.length === 11 && digits.startsWith('1')) {
      const formatted = `+${digits}`;
      return { valid: true, formatted };
    } else {
      return { valid: false, error: 'Invalid phone number format. Must be 10 or 11 digits.' };
    }
  }

  validateEmailAddress(email: string): { valid: boolean; reason?: string } {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Invalid email format' };
    }

    // Check for common disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com'
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(domain)) {
      return { valid: false, reason: 'Disposable email domain not allowed' };
    }

    return { valid: true };
  }
}

// Export service instances
export const flexPathService = new FlexPathService();
export const mailgunService = new MailgunService();
export const piiProtectionService = new PIIProtectionService();