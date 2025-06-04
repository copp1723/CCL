import { storage } from '../storage';
import { generateReturnToken } from '../services/token';
import { mailgunService } from '../services/external-apis';

export class EmailReengagementService {
  async processLeadReady(visitorId: number): Promise<{ success: boolean; campaignId?: number; error?: string }> {
    try {
      const visitor = await storage.getVisitor(visitorId);
      if (!visitor) {
        throw new Error('Visitor not found');
      }

      const returnToken = generateReturnToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create email campaign
      const campaign = await storage.createEmailCampaign({
        visitorId,
        returnToken,
        expiresAt,
        emailSent: false,
        emailOpened: false,
        clicked: false,
      });

      // Generate email content
      const emailContent = this.generateReengagementEmail(returnToken);
      
      // Send email via Mailgun
      const emailResult = await mailgunService.sendEmail({
        to: `visitor_${visitor.emailHash.substring(0, 8)}@example.com`, // Simulated email for demo
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: ['reengagement', 'auto-loan'],
        customData: {
          visitorId: visitorId,
          campaignId: campaign.id,
          returnToken: returnToken
        }
      });

      if (emailResult.success) {
        await storage.updateEmailCampaign(campaign.id, {
          emailSent: true,
        });

        await storage.createAgentActivity({
          agentName: 'EmailReengagementAgent',
          action: 'email_sent',
          status: 'success',
          details: `Reengagement email sent with token ${returnToken}`,
          visitorId,
        });
      } else {
        await storage.createAgentActivity({
          agentName: 'EmailReengagementAgent',
          action: 'email_send_failed',
          status: 'error',
          details: emailResult.error || 'Unknown email error',
          visitorId,
        });
      }

      return { success: emailResult.success, campaignId: campaign.id };
    } catch (error) {
      await storage.createAgentActivity({
        agentName: 'EmailReengagementAgent',
        action: 'campaign_creation_failed',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async handleEmailEngagement(returnToken: string, engagementType: 'opened' | 'clicked'): Promise<{ success: boolean; error?: string }> {
    try {
      const campaign = await storage.getEmailCampaignByToken(returnToken);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const updates: any = {};
      if (engagementType === 'opened') {
        updates.emailOpened = true;
      } else if (engagementType === 'clicked') {
        updates.clicked = true;
      }

      await storage.updateEmailCampaign(campaign.id, updates);

      await storage.createAgentActivity({
        agentName: 'EmailReengagementAgent',
        action: `email_${engagementType}`,
        status: 'success',
        details: `Email ${engagementType} by visitor`,
        visitorId: campaign.visitorId,
      });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private generateReengagementEmail(returnToken: string): { subject: string; html: string; text: string } {
    const returnUrl = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/return/${returnToken}`;
    
    return {
      subject: 'Complete Your Auto Loan Application - Pre-Approved Options Available',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Don't Miss Out on Your Pre-Approved Auto Loan</h2>
          <p>You were just moments away from completing your auto loan application.</p>
          <p>Good news! We've reserved your pre-qualified status for the next 24 hours.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0; color: #1f2937;">What happens next:</h3>
            <ul style="margin: 10px 0;">
              <li>Complete your application in under 3 minutes</li>
              <li>Get instant pre-approval decision</li>
              <li>Connect with local dealers with your approved amount</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${returnUrl}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Continue My Application
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This link expires in 24 hours. Questions? Reply to this email or call (555) 123-AUTO.
          </p>
        </div>
      `,
      text: `
        Don't Miss Out on Your Pre-Approved Auto Loan
        
        You were just moments away from completing your auto loan application.
        
        Good news! We've reserved your pre-qualified status for the next 24 hours.
        
        What happens next:
        - Complete your application in under 3 minutes
        - Get instant pre-approval decision
        - Connect with local dealers with your approved amount
        
        Continue your application: ${returnUrl}
        
        This link expires in 24 hours. Questions? Reply to this email or call (555) 123-AUTO.
      `
    };
  }
}

export const emailReengagementService = new EmailReengagementService();