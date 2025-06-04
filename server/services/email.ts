/**
 * Mock email service for sending re-engagement emails
 * In production, this would integrate with SendGrid or similar
 */

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY || 'mock_api_key';
  }

  /**
   * Send re-engagement email with return token
   */
  async sendReengagementEmail(
    recipient: EmailRecipient,
    returnToken: string,
    abandonmentStep: number
  ): Promise<EmailResult> {
    try {
      // In production, this would make actual API call to SendGrid
      console.log(`[EmailService] Sending re-engagement email to ${recipient.email}`);
      console.log(`[EmailService] Return token: ${returnToken}`);
      console.log(`[EmailService] Abandonment step: ${abandonmentStep}`);

      const template = this.getReengagementTemplate(returnToken, abandonmentStep);
      
      // Mock API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate 95% success rate
      const success = Math.random() > 0.05;
      
      if (success) {
        return {
          success: true,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else {
        return {
          success: false,
          error: 'Email delivery failed'
        };
      }
    } catch (error) {
      console.error('[EmailService] Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get email template based on abandonment step
   */
  private getReengagementTemplate(returnToken: string, abandonmentStep: number): EmailTemplate {
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const returnUrl = `https://${baseUrl}/chat?token=${returnToken}`;

    const templates = {
      1: {
        subject: "Complete Your Car Loan Application - Get Pre-Approved Today!",
        htmlContent: `
          <h2>Don't Miss Out on Your Car Loan Pre-Approval!</h2>
          <p>Hi there,</p>
          <p>We noticed you started your car loan application but didn't finish. Our AI assistant is ready to help you complete it in just a few minutes!</p>
          <p><strong>Why complete your application?</strong></p>
          <ul>
            <li>Get pre-approved instantly</li>
            <li>No impact on your credit score</li>
            <li>Access to exclusive dealer network</li>
            <li>Competitive rates for all credit types</li>
          </ul>
          <p><a href="${returnUrl}" style="background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Continue Application</a></p>
          <p>Questions? Our AI assistant is available 24/7 to help!</p>
        `,
        textContent: `Don't miss out on your car loan pre-approval! Complete your application: ${returnUrl}`
      },
      2: {
        subject: "Almost There! Finish Your Car Loan Application",
        htmlContent: `
          <h2>You're Almost Pre-Approved!</h2>
          <p>Hi,</p>
          <p>You were so close to completing your car loan application. Just one more step to get your pre-approval!</p>
          <p>Our AI assistant has your information saved and ready to go.</p>
          <p><a href="${returnUrl}" style="background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Finish in 2 Minutes</a></p>
        `,
        textContent: `You're almost pre-approved! Finish your application: ${returnUrl}`
      },
      3: {
        subject: "Final Step: Complete Your Car Loan Pre-Approval",
        htmlContent: `
          <h2>One Click Away from Pre-Approval</h2>
          <p>Hi,</p>
          <p>Your car loan application is 90% complete. Don't let this opportunity slip away!</p>
          <p>Complete your application now and get:</p>
          <ul>
            <li>Instant pre-approval decision</li>
            <li>Your personalized loan terms</li>
            <li>Access to our dealer network</li>
          </ul>
          <p><a href="${returnUrl}" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Get Pre-Approved Now</a></p>
        `,
        textContent: `One click away from pre-approval! Complete now: ${returnUrl}`
      }
    };

    return templates[abandonmentStep as keyof typeof templates] || templates[1];
  }

  /**
   * Track email opens (webhook handler)
   */
  async trackEmailOpen(messageId: string): Promise<void> {
    console.log(`[EmailService] Email opened: ${messageId}`);
  }

  /**
   * Track email clicks (webhook handler)
   */
  async trackEmailClick(messageId: string, url: string): Promise<void> {
    console.log(`[EmailService] Email clicked: ${messageId}, URL: ${url}`);
  }
}

export const emailService = new EmailService();
