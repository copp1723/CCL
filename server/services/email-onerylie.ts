import Mailgun from "mailgun.js";
import formData from "form-data";
import config from "../config/environment";

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
      throw new Error("MAILGUN_API_KEY is required for email functionality");
    }

    const mailgun = new Mailgun(formData);
    this.mg = mailgun.client({
      username: "api",
      key: conf.MAILGUN_API_KEY,
    });

    this.domain = "mail.onerylie.com";
    this.fromEmail = "noreply@onerylie.com";
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const emailData = {
        from: params.from || this.fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      };

      const response = await this.mg.messages.create(this.domain, emailData);

      return {
        success: true,
        messageId: response.id,
      };
    } catch (error: any) {
      console.error("Mailgun email error:", error);

      return {
        success: false,
        error: error.message || "Failed to send email",
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
      text,
    });
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<EmailResponse> {
    const subject = `${firstName}, your auto loan application is being processed`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Complete Car Loans</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Trusted Auto Finance Partner</p>
        </div>
        
        <div style="padding: 30px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Hey ${firstName}!</h2>
          
          <p style="color: #374151; line-height: 1.6;">Thanks for starting your auto loan application with Complete Car Loans. I'm Cathy, your personal finance specialist, and I'm here to help you get behind the wheel of your dream car.</p>
          
          <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #1e40af; font-size: 18px;">Your Application Status</h3>
            <p style="margin: 10px 0; color: #1f2937;"><strong>Status:</strong> In Review</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>Expected Response:</strong> Within 2-4 hours</p>
            <p style="margin: 10px 0; color: #1f2937;"><strong>Next Step:</strong> Pre-approval decision</p>
          </div>
          
          <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #065f46;">Why Complete Car Loans?</h3>
            <ul style="color: #047857; margin: 0; padding-left: 20px;">
              <li style="margin: 8px 0;">✓ Work with all credit types - even bad credit</li>
              <li style="margin: 8px 0;">✓ Same-day approvals available</li>
              <li style="margin: 8px 0;">✓ Access to 15,000+ dealers nationwide</li>
              <li style="margin: 8px 0;">✓ No hidden fees or surprises</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://completecarloans.com/status" 
               style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Check Application Status
            </a>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">I'll personally review your application and be in touch with your pre-approval details soon. If you have any questions, just reply to this email or call me directly.</p>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #1f2937;"><strong>Cathy Johnson</strong><br>
            <em style="color: #6b7280;">Personal Auto Finance Specialist</em><br>
            Complete Car Loans<br>
            <a href="tel:1-800-CARLOANS" style="color: #2563eb;">1-800-CARLOANS</a></p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p>This email was sent because you applied for auto financing with Complete Car Loans.<br>
          If you didn't apply, please ignore this email or <a href="#" style="color: #6b7280;">contact us</a>.</p>
        </div>
      </div>
    `;

    const text = `
Hi ${firstName},

Thanks for starting your auto loan application with Complete Car Loans. I'm Cathy, your personal finance specialist.

Your Application Status:
- Status: In Review  
- Expected Response: Within 2-4 hours
- Next Step: Pre-approval decision

Why Complete Car Loans?
- Work with all credit types - even bad credit
- Same-day approvals available  
- Access to 15,000+ dealers nationwide
- No hidden fees or surprises

I'll personally review your application and be in touch with your pre-approval details soon. If you have any questions, just reply to this email or call me at 1-800-CARLOANS.

Best regards,
Cathy Johnson
Personal Auto Finance Specialist
Complete Car Loans
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async testConnection(): Promise<{ success: boolean; domain: string; error?: string }> {
    try {
      // Test with a simple domain validation
      const response = await this.mg.domains.get(this.domain);

      return {
        success: true,
        domain: this.domain,
      };
    } catch (error: any) {
      return {
        success: false,
        domain: this.domain,
        error: error.message,
      };
    }
  }

  async sendReengagementEmail(params: {
    to: string;
    subject: string;
    content: string;
    returnToken?: string;
  }): Promise<EmailResponse> {
    const { to, subject, content, returnToken } = params;

    let htmlContent = content.replace(/\n/g, "<br>");
    if (returnToken) {
      const returnUrl = `${process.env.BASE_URL || "https://completecarloans.com"}/return/${returnToken}`;
      htmlContent += `<br><br><a href="${returnUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Continue Your Application</a>`;
    }

    return this.sendEmail({
      to,
      subject,
      text: content,
      html: htmlContent,
    });
  }

  getProviderName(): string {
    return "Mailgun";
  }
}

export const emailService = new OnerylieEmailService();
export default emailService;
