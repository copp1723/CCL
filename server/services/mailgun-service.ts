import formData from "form-data";
import Mailgun from "mailgun.js";
import DOMPurify from "isomorphic-dompurify";

const mailgun = new Mailgun(formData);

// Initialize Mailgun client
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY || "",
});

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  variables?: Record<string, string>;
}

export class MailgunService {
  private domain: string;
  private defaultFrom: string;

  constructor() {
    this.domain = process.env.MAILGUN_DOMAIN || "mail.onerylie.com";
    this.defaultFrom = `Cathy <cathy@${this.domain}>`;
  }

  /**
   * Send a single email
   */
  async sendEmail(emailData: EmailData): Promise<any> {
    try {
      // Sanitize HTML content before sending
      const sanitizedHtml = DOMPurify.sanitize(emailData.html);

      const messageData = {
        from: emailData.from || this.defaultFrom,
        to: emailData.to,
        subject: emailData.subject,
        html: sanitizedHtml,
        text: emailData.text || this.stripHtml(sanitizedHtml),
      };

      const result = await mg.messages.create(this.domain, messageData);
      console.log(`Email sent to ${emailData.to}:`, result.id);
      return result;
    } catch (error) {
      console.error(`Failed to send email to ${emailData.to}:`, error);
      throw error;
    }
  }

  /**
   * Send bulk emails (for campaigns)
   */
  async sendBulkEmails(
    emails: EmailData[]
  ): Promise<{ sent: number; failed: number; errors: any[] }> {
    let sent = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const email of emails) {
      try {
        await this.sendEmail(email);
        sent++;
        // Add delay to respect rate limits
        await this.delay(100);
      } catch (error) {
        failed++;
        errors.push({ email: email.to, error });
      }
    }

    return { sent, failed, errors };
  }

  /**
   * Send campaign emails with template
   */
  async sendCampaignEmails(
    leads: Array<{ email: string; firstName?: string; lastName?: string; [key: string]: any }>,
    template: EmailTemplate
  ): Promise<{ sent: number; failed: number; errors: any[] }> {
    const emails: EmailData[] = leads.map(lead => ({
      to: lead.email,
      subject: this.processTemplate(template.subject, lead),
      html: this.processTemplate(template.body, lead),
    }));

    return await this.sendBulkEmails(emails);
  }

  /**
   * Process template with variables (simple replacement)
   */
  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;

    // Sanitize all variable values before replacing
    const sanitizedVariables: Record<string, string> = {};
    Object.entries(variables).forEach(([key, value]) => {
      sanitizedVariables[key] = DOMPurify.sanitize(String(value || ""), { ALLOWED_TAGS: [] });
    });

    // Replace common variables
    if (sanitizedVariables.firstName) {
      processed = processed.replace(/\{\{firstName\}\}/g, sanitizedVariables.firstName);
      processed = processed.replace(/\{\{first_name\}\}/g, sanitizedVariables.firstName);
    }

    if (sanitizedVariables.lastName) {
      processed = processed.replace(/\{\{lastName\}\}/g, sanitizedVariables.lastName);
      processed = processed.replace(/\{\{last_name\}\}/g, sanitizedVariables.lastName);
    }

    if (sanitizedVariables.email) {
      processed = processed.replace(/\{\{email\}\}/g, sanitizedVariables.email);
    }

    // Replace any other custom variables
    Object.entries(sanitizedVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      processed = processed.replace(regex, value);
    });

    return processed;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    // Use DOMPurify to strip all HTML tags and keep only text content
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true,
    });
    return clean.replace(/\s+/g, " ").trim();
  }

  /**
   * Add delay between emails
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate email configuration
   */
  isConfigured(): boolean {
    return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      domain: this.domain,
      apiKeyPresent: !!process.env.MAILGUN_API_KEY,
    };
  }
}

// Export singleton instance
export const mailgunService = new MailgunService();
