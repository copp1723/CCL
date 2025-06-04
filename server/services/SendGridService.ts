import sgMail from '@sendgrid/mail';

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

class SendGridService {
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      console.log('SendGrid service initialized');
    } else {
      console.log('SendGrid API key not found - email sending will be simulated');
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
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        text: params.text,
        html: params.html
      };

      const [response] = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response.headers['x-message-id'] || 'unknown'
      };
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      
      let errorMessage = 'Unknown email error';
      if (error.response) {
        errorMessage = error.response.body?.errors?.[0]?.message || error.message;
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
        message: 'SendGrid is properly configured'
      };
    } else {
      return {
        configured: false,
        message: 'SendGrid API key not configured. Set SENDGRID_API_KEY environment variable.'
      };
    }
  }
}

export const sendGridService = new SendGridService();