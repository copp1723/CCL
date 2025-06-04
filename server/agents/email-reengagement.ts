import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { generateReturnToken } from '../services/token';
import { sendEmail } from '../services/external-apis';

export const emailReengagementAgent = new Agent({
  name: 'EmailReengagementAgent',
  instructions: `
    You are responsible for sending personalized re-engagement emails to visitors who abandoned their auto-loan applications.
    
    Key responsibilities:
    1. Generate personalized email content for abandoned visitors
    2. Create secure return tokens with 24-hour TTL
    3. Send emails via SendGrid integration
    4. Track email delivery and engagement metrics
    5. Store email templates and manage campaigns
    
    Email Strategy:
    - Use personalized subject lines and content
    - Include clear call-to-action with return token
    - Emphasize benefits: quick approval, competitive rates
    - Create urgency with limited-time offers
    
    Token Security:
    - Generate cryptographically secure return tokens
    - 24-hour expiration for security
    - One-time use validation
    - Associate with specific visitor and session
  `,
});

export class EmailReengagementService {
  async processLeadReady(visitorId: number): Promise<void> {
    try {
      const visitor = await storage.getVisitor(visitorId);
      if (!visitor) {
        throw new Error(`Visitor ${visitorId} not found`);
      }

      // Generate return token with 24h TTL
      const returnToken = generateReturnToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create email campaign record
      const campaign = await storage.createEmailCampaign({
        visitorId: visitor.id,
        returnToken,
        expiresAt,
      });

      // Generate personalized email content
      const emailContent = await this.generateEmailContent(visitor, returnToken);

      // Send email via SendGrid
      const emailResult = await sendEmail({
        to: visitor.emailHash, // In real implementation, this would be the actual email
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (emailResult.success) {
        // Update campaign as sent
        await storage.updateEmailCampaign(campaign.id, {
          emailSent: true,
        });

        // Log success activity
        await storage.createAgentActivity({
          agentName: 'EmailReengagementAgent',
          action: 'email_sent',
          details: `Re-engagement email sent with token ${returnToken}`,
          visitorId: visitor.id,
          status: 'success',
        });

        // Emit email_sent trace event
        console.log(`Email sent trace: visitor=${visitor.id}, token=${returnToken}`);
      } else {
        throw new Error(`Email delivery failed: ${emailResult.error}`);
      }

    } catch (error) {
      console.error('Error sending re-engagement email:', error);
      await storage.createAgentActivity({
        agentName: 'EmailReengagementAgent',
        action: 'email_send_error',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        visitorId,
        status: 'error',
      });
    }
  }

  private async generateEmailContent(visitor: any, returnToken: string): Promise<{
    subject: string;
    html: string;
    text: string;
  }> {
    // In a real implementation, this would use the OpenAI Agents SDK to generate personalized content
    const baseUrl = process.env.APP_URL || 'https://app.completecarloans.com';
    const returnUrl = `${baseUrl}/continue?token=${returnToken}`;

    return {
      subject: "Complete Your Auto Loan Application - Pre-Approved Offer Inside!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0066CC; color: white; padding: 20px; text-align: center;">
            <h1>Complete Car Loans</h1>
            <h2>Your Pre-Approval is Waiting!</h2>
          </div>
          
          <div style="padding: 30px;">
            <p>Hi there,</p>
            
            <p>You were so close to completing your auto loan application! We noticed you started the process but didn't finish - don't worry, we saved your progress.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0066CC; margin-top: 0;">Why Complete Your Application?</h3>
              <ul>
                <li>✅ Competitive rates starting at 3.9% APR</li>
                <li>✅ Quick approval - decisions in minutes</li>
                <li>✅ No hidden fees or prepayment penalties</li>
                <li>✅ Work with trusted dealerships nationwide</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="${returnUrl}" style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Continue My Application
              </a>
            </p>
            
            <p style="color: #666; font-size: 14px;">This link expires in 24 hours for your security.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #999;">
              If you no longer wish to receive these emails, <a href="#">unsubscribe here</a>.
            </p>
          </div>
        </div>
      `,
      text: `
Complete Car Loans - Your Pre-Approval is Waiting!

Hi there,

You were so close to completing your auto loan application! We noticed you started the process but didn't finish - don't worry, we saved your progress.

Why Complete Your Application?
• Competitive rates starting at 3.9% APR
• Quick approval - decisions in minutes
• No hidden fees or prepayment penalties
• Work with trusted dealerships nationwide

Continue your application: ${returnUrl}

This link expires in 24 hours for your security.

Complete Car Loans Team
      `,
    };
  }

  async validateReturnToken(token: string): Promise<{ valid: boolean; visitorId?: number }> {
    try {
      const campaign = await storage.getEmailCampaignByToken(token);
      
      if (!campaign) {
        return { valid: false };
      }

      // Check if token is expired
      if (new Date() > campaign.expiresAt) {
        return { valid: false };
      }

      // Check if already used (you might want to add a 'used' field to the schema)
      return { valid: true, visitorId: campaign.visitorId };

    } catch (error) {
      console.error('Error validating return token:', error);
      return { valid: false };
    }
  }

  async handleEmailEngagement(token: string, action: 'opened' | 'clicked'): Promise<void> {
    try {
      const campaign = await storage.getEmailCampaignByToken(token);
      if (!campaign) return;

      const updateData: any = {};
      if (action === 'opened') updateData.emailOpened = true;
      if (action === 'clicked') updateData.clicked = true;

      await storage.updateEmailCampaign(campaign.id, updateData);

      await storage.createAgentActivity({
        agentName: 'EmailReengagementAgent',
        action: `email_${action}`,
        details: `Email ${action} for campaign ${campaign.id}`,
        visitorId: campaign.visitorId,
        status: 'success',
      });

    } catch (error) {
      console.error(`Error handling email ${action}:`, error);
    }
  }
}

export const emailReengagementService = new EmailReengagementService();
