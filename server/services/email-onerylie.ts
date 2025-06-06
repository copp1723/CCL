import Mailgun from 'mailgun.js';
import formData from 'form-data';
import config from '../config/environment';

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class OnerylieEmailService {
  private mg: any;
  private domain: string;
  private fromEmail: string;

  constructor() {
    const conf = config.get();
    
    if (!conf.MAILGUN_API_KEY) {
      throw new Error('MAILGUN_API_KEY is required for email functionality');
    }

    const mailgun = new Mailgun(formData);
    this.mg = mailgun.client({
      username: 'api',
      key: conf.MAILGUN_API_KEY
    });
    
    this.domain = 'mail.onerylie.com';
    this.fromEmail = 'noreply@onerylie.com';
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const emailData = {
        from: params.from || this.fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html
      };

      const response = await this.mg.messages.create(this.domain, emailData);
      
      return {
        success: true,
        messageId: response.id
      };
    } catch (error: any) {
      console.error('Mailgun email error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }

  async sendLeadFollowup(email: string, firstName: string): Promise<EmailResponse> {
    const subject = `${firstName}, your auto loan approval is waiting`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Hey ${firstName}!</h2>
        
        <p>I noticed you started an auto loan application but didn't finish it. No worries - happens to everyone!</p>
        
        <p>The good news? Your pre-approval is still available, and I can help you get behind the wheel of your dream car in just a few minutes.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Why Complete Car Loans?</h3>
          <ul style="color: #374151;">
            <li>✓ Same-day approvals available</li>
            <li>✓ Work with all credit types</li>
            <li>✓ No hidden fees or surprises</li>
            <li>✓ Thousands of dealers nationwide</li>
          </ul>
        </div>
        
        <p style="text-align: center;">
          <a href="https://onerylie.com/continue-application" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Continue My Application
          </a>
        </p>
        
        <p>Have questions? Just reply to this email or call me directly. I'm here to help make your car buying experience as smooth as possible.</p>
        
        <p>Best regards,<br>
        Cathy<br>
        <em>Your Personal Auto Finance Specialist</em><br>
        Complete Car Loans</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #6b7280;">
          This email was sent because you started an auto loan application with Complete Car Loans. 
          If you no longer wish to receive these emails, you can 
          <a href="https://onerylie.com/unsubscribe" style="color: #6b7280;">unsubscribe here</a>.
        </p>
      </div>
    `;

    const text = `
Hey ${firstName}!

I noticed you started an auto loan application but didn't finish it. No worries - happens to everyone!

The good news? Your pre-approval is still available, and I can help you get behind the wheel of your dream car in just a few minutes.

Why Complete Car Loans?
- Same-day approvals available
- Work with all credit types  
- No hidden fees or surprises
- Thousands of dealers nationwide

Continue your application: https://onerylie.com/continue-application

Have questions? Just reply to this email or call me directly. I'm here to help make your car buying experience as smooth as possible.

Best regards,
Cathy
Your Personal Auto Finance Specialist
Complete Car Loans
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<EmailResponse> {
    const subject = `Welcome to Complete Car Loans, ${firstName}!`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome ${firstName}!</h2>
        
        <p>Thanks for choosing Complete Car Loans. I'm Cathy, your personal auto finance specialist, and I'm excited to help you get approved for your next vehicle.</p>
        
        <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #065f46;">What happens next?</h3>
          <ol style="color: #047857;">
            <li>I'll review your application within 2 hours</li>
            <li>You'll receive a pre-approval decision</li>
            <li>I'll connect you with verified dealers</li>
            <li>Drive away in your new car!</li>
          </ol>
        </div>
        
        <p>I'll be in touch soon with your approval details. In the meantime, feel free to reach out if you have any questions.</p>
        
        <p>Best regards,<br>
        Cathy<br>
        <em>Your Personal Auto Finance Specialist</em><br>
        Complete Car Loans</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html
    });
  }

  async testConnection(): Promise<{ success: boolean; domain: string; error?: string }> {
    try {
      // Test with a simple domain validation
      const response = await this.mg.domains.get(this.domain);
      
      return {
        success: true,
        domain: this.domain
      };
    } catch (error: any) {
      return {
        success: false,
        domain: this.domain,
        error: error.message
      };
    }
  }
}

export const emailService = new OnerylieEmailService();
export default emailService;