import formData from 'form-data';
import Mailgun from 'mailgun.js';

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

class MailgunService {
  private mg: any;
  private isConfigured = false;
  private domain: string | undefined;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    
    if (apiKey && domain) {
      const mailgun = new Mailgun(formData);
      this.mg = mailgun.client({
        username: 'api',
        key: apiKey,
      });
      this.domain = domain;
      this.isConfigured = true;
      console.log('Mailgun service initialized');
    } else {
      console.log('Mailgun API key or domain not found - email sending will be simulated');
    }
  }

  async sendEmail(params: EmailParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.isConfigured) {
      // Simulate email sending for demo purposes
      console.log(`[SIMULATED EMAIL] To: ${params.to}, Subject: ${params.subject}`);
      return {
        success: true,
        messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    }

    try {
      const messageData = {
        from: params.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html
      };

      const response = await this.mg.messages.create(this.domain!, messageData);
      
      return {
        success: true,
        messageId: response.id || response.message || 'unknown'
      };
    } catch (error: any) {
      console.error('Mailgun email error:', error);
      
      let errorMessage = 'Unknown email error';
      if (error.response && error.response.body) {
        errorMessage = error.response.body.message || error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  validateConfiguration(): {
    configured: boolean;
    message: string;
  } {
    if (this.isConfigured) {
      return {
        configured: true,
        message: `Mailgun is properly configured for domain: ${this.domain}`
      };
    } else {
      return {
        configured: false,
        message: 'Mailgun not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.'
      };
    }
  }
}

export const mailgunService = new MailgunService();