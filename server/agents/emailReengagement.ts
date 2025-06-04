import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import { sendEmail } from '../services/external';
import crypto from 'crypto';
import type { Visitor } from '@shared/schema';

export class EmailReengagementAgent {
  private agent: Agent;

  constructor() {
    const sendReengagementEmailTool = tool({
      name: 'send_reengagement_email',
      description: 'Send personalized re-engagement email to abandoned visitors',
      execute: async ({ visitorId, emailTemplate }: {
        visitorId: number;
        emailTemplate: string;
      }) => {
        return await this.sendReengagementEmailInternal(visitorId, emailTemplate);
      },
    });

    const generateReturnTokenTool = tool({
      name: 'generate_return_token',
      description: 'Generate secure return token with 24h TTL',
      execute: async ({ visitorId }: { visitorId: number }) => {
        return await this.generateReturnToken(visitorId);
      },
    });

    this.agent = new Agent({
      name: 'EmailReengagementAgent',
      instructions: `
        You are responsible for re-engaging abandoned visitors through personalized emails.
        
        Key responsibilities:
        1. Send personalized re-engagement emails via SendGrid
        2. Generate secure return tokens (GUID) with 24-hour TTL
        3. Store email templates and track delivery
        4. Emit email_sent trace events
        5. Maintain high inbox delivery rates (target: 95%+)
        
        Always generate unique return tokens for each email and track engagement metrics.
        Personalize email content based on visitor's progress in the application.
      `,
      tools: [sendReengagementEmailTool, generateReturnTokenTool],
    });
  }

  private generateReturnToken(visitorId: number): string {
    return crypto.randomUUID();
  }

  private async sendReengagementEmailInternal(visitorId: number, template: string) {
    const visitor = await storage.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('Visitor not found');
    }

    const returnToken = this.generateReturnToken(visitorId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store return token
    await storage.createReturnToken({
      token: returnToken,
      visitorId,
      expiresAt,
      isUsed: false,
    });

    // Send email (mock implementation)
    const emailSent = await sendEmail({
      to: `visitor_${visitor.emailHash}@example.com`, // This would be the actual email in production
      subject: 'Complete Your Car Loan Application',
      template,
      returnToken,
    });

    if (emailSent) {
      await storage.createActivity({
        type: 'email_sent',
        description: `Re-engagement email sent to visitor ${visitorId}`,
        agentId: (await storage.getAgentByType('email_reengagement'))?.id,
        relatedId: visitorId.toString(),
        metadata: { 
          returnToken,
          emailHash: visitor.emailHash,
          expiresAt: expiresAt.toISOString()
        }
      });

      // Update agent metrics
      const agent = await storage.getAgentByType('email_reengagement');
      if (agent) {
        await storage.updateAgent(agent.id, {
          eventsProcessed: (agent.eventsProcessed || 0) + 1,
          lastActivity: new Date(),
        });
      }

      return { success: true, returnToken, expiresAt };
    }

    throw new Error('Failed to send email');
  }

  async sendReengagementEmail(visitor: Visitor) {
    const emailTemplate = this.generateEmailTemplate(visitor);
    
    try {
      const result = await this.sendReengagementEmailInternal(visitor.id, emailTemplate);
      
      await storage.createActivity({
        type: 'email_sent',
        description: `Re-engagement email sent to visitor ${visitor.id}`,
        agentId: (await storage.getAgentByType('email_reengagement'))?.id,
        relatedId: visitor.id.toString(),
        metadata: result
      });

      return result;
    } catch (error) {
      await storage.createActivity({
        type: 'email_failed',
        description: `Failed to send re-engagement email to visitor ${visitor.id}`,
        agentId: (await storage.getAgentByType('email_reengagement'))?.id,
        relatedId: visitor.id.toString(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }

  private generateEmailTemplate(visitor: Visitor): string {
    return `
      <html>
        <body>
          <h2>Don't Miss Out on Your Car Loan Pre-Approval!</h2>
          <p>Hi there,</p>
          <p>We noticed you started your car loan application but didn't finish. 
             We're here to help you get back on track!</p>
          <p>Complete your application now and get:</p>
          <ul>
            <li>Instant pre-approval decision</li>
            <li>Competitive rates starting at 3.99% APR</li>
            <li>No impact to your credit score</li>
          </ul>
          <p><a href="{return_url}" style="background: #0066CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Complete My Application</a></p>
          <p>This link expires in 24 hours.</p>
          <p>Best regards,<br/>Complete Car Loans Team</p>
        </body>
      </html>
    `;
  }

  getAgent() {
    return this.agent;
  }
}
