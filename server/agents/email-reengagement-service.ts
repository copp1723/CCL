import { BaseAgent, AgentResult } from "./base-agent";
// Remove dependency on @openai/agents
// import { tool } from "@openai/agents";
import { storage } from "../storage";
import { randomUUID } from "crypto";

interface EmailContent {
  subject: string;
  body: string;
}

interface EmailService {
  sendReengagementEmail(params: {
    to: string;
    subject: string;
    body: string;
    returnToken: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
  getProviderName(): string;
}

// Mock email service for now
class MockEmailService implements EmailService {
  async sendReengagementEmail(params: {
    to: string;
    subject: string;
    body: string;
    returnToken: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Simulate email sending
    return {
      success: true,
      messageId: `msg_${Date.now()}`,
    };
  }

  getProviderName(): string {
    return "MockProvider";
  }
}

export class EmailReengagementService extends BaseAgent {
  private emailService: EmailService;
  private tools: any[];

  constructor() {
    const tools = [
      {
        name: "generate_email_content",
        description: "Generate personalized email content based on visitor abandonment data",
        execute: (params: any) => this.generateEmailContent(params),
      },
      {
        name: "create_return_token",
        description: "Create a secure return token with TTL",
        execute: (params: any) => this.createReturnToken(params),
      },
      {
        name: "send_email",
        description: "Send email via service provider",
        execute: (params: any) => this.sendEmail(params),
      },
    ];

    super({
      name: "EmailReengagementAgent",
      instructions: `
        You are responsible for sending personalized re-engagement emails.
        Your primary tasks:
        1. Generate personalized email content
        2. Create secure return tokens with TTL
        3. Send emails via service provider
        4. Track delivery and engagement metrics
        
        Always use empathetic, human-like communication.
        Never reveal you are an AI system.
      `,
      tools: [],
    });

    this.emailService = new MockEmailService();

    // Add tools after super() call
    this.tools = [
      this.createGenerateEmailContentTool(),
      this.createCreateReturnTokenTool(),
      this.createSendEmailTool(),
    ];
  }

  private createGenerateEmailContentTool() {
    return {
      name: "generate_email_content",
      description: "Generate personalized email content based on visitor abandonment data",
      execute: (params: any) => this.generateEmailContent(params),
    };
  }

  private createCreateReturnTokenTool() {
    return {
      name: "create_return_token",
      description: "Create a secure return token with TTL",
      execute: (params: any) => this.createReturnToken(params),
    };
  }

  private createSendEmailTool() {
    return {
      name: "send_email",
      description: "Send email via service provider",
      execute: (params: any) => this.sendEmail(params),
    };
  }

  private async generateEmailContent(params: { visitorId: number; abandonmentStep: number }) {
    try {
      const { visitorId, abandonmentStep } = params;

      const visitor = await storage.getVisitorById(visitorId.toString());
      if (!visitor) {
        throw new Error("Visitor not found");
      }

      const content = this.generatePersonalizedContent(abandonmentStep);

      return this.createSuccessResult(content, {
        operation: "generate_email_content",
        step: abandonmentStep,
      });
    } catch (error) {
      return this.handleError("generate_email_content", error);
    }
  }

  private async createReturnToken(params: { visitorId: number }) {
    try {
      const { visitorId } = params;

      const returnToken = randomUUID();
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24);

      await storage.updateVisitor(visitorId.toString(), {
        metadata: {
          returnToken,
          returnTokenExpiry: expiryTime.toISOString(),
        },
      });

      return this.createSuccessResult(
        {
          returnToken,
          expiryTime: expiryTime.toISOString(),
        },
        {
          operation: "create_return_token",
        }
      );
    } catch (error) {
      return this.handleError("create_return_token", error);
    }
  }

  private async sendEmail(params: {
    visitorId: number;
    emailHash: string;
    subject: string;
    body: string;
    returnToken: string;
  }) {
    try {
      const { visitorId, emailHash, subject, body, returnToken } = params;

      const emailResult = await this.emailService.sendReengagementEmail({
        to: emailHash,
        subject,
        body,
        returnToken,
      });

      if (emailResult.success) {
        await this.logActivity(
          "email_sent",
          `Re-engagement email sent via ${this.emailService.getProviderName()}`,
          visitorId.toString(),
          {
            messageId: emailResult.messageId,
            provider: this.emailService.getProviderName(),
          }
        );
      }

      return this.createSuccessResult(emailResult, {
        operation: "send_email",
        provider: this.emailService.getProviderName(),
      });
    } catch (error) {
      return this.handleError("send_email", error);
    }
  }

  private generatePersonalizedContent(abandonmentStep: number): EmailContent {
    const stepMessages = {
      1: {
        subject: "Complete Your Car Loan Application - Just One More Step!",
        body: `Hi there!\n\nWe noticed you started your car loan application but didn't finish. Don't worry - we've saved your progress!\n\n✅ Quick 2-minute completion\n✅ Competitive rates starting at 3.9% APR\n✅ Get approved in minutes\n\nClick here to continue: {{RETURN_LINK}}\n\nBest regards,\nThe CCL Team`,
      },
      2: {
        subject: "Your Car Loan is Almost Ready - Complete Your Application",
        body: `Hi there!\n\nYou're so close to getting your car loan approved! We just need a few more details.\n\n✅ Pre-qualification in progress\n✅ Rates as low as 3.9% APR\n✅ Multiple lender options\n\nContinue your application: {{RETURN_LINK}}\n\nBest regards,\nThe CCL Team`,
      },
      3: {
        subject: "Final Step: Complete Your Car Loan Application Now",
        body: `Hi there!\n\nYou're on the final step! Complete it now to get instant approval.\n\n✅ Almost approved\n✅ Best rates available\n✅ Instant decision\n\nFinish your application: {{RETURN_LINK}}\n\nBest regards,\nThe CCL Team`,
      },
    };

    return stepMessages[abandonmentStep as keyof typeof stepMessages] || stepMessages[1];
  }

  async sendReengagementEmail(visitorId: number): Promise<AgentResult<{ campaignId?: number }>> {
    try {
      const visitor = await storage.getVisitorById(visitorId.toString());
      if (!visitor) {
        throw new Error("Visitor not found");
      }

      const returnToken = randomUUID();
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24);

      await storage.updateVisitor(visitorId.toString(), {
        metadata: {
          returnToken,
          returnTokenExpiry: expiryTime.toISOString(),
        },
      });

      const content = this.generatePersonalizedContent(visitor.abandonmentStep || 1);

      const emailResult = await this.emailService.sendReengagementEmail({
        to: visitor.emailHash,
        subject: content.subject,
        body: content.body.replace(
          "{{RETURN_LINK}}",
          `${process.env.BASE_URL || "https://app.completecarloans.com"}/return/${returnToken}`
        ),
        returnToken,
      });

      if (emailResult.success) {
        await this.logActivity(
          "email_campaign_sent",
          "Re-engagement email sent successfully",
          visitorId.toString(),
          {
            messageId: emailResult.messageId,
            abandonmentStep: visitor.abandonmentStep,
          }
        );

        return this.createSuccessResult(
          { campaignId: 1 },
          {
            operation: "sendReengagementEmail",
            messageId: emailResult.messageId,
          }
        );
      } else {
        throw new Error(`Email sending failed: ${emailResult.error}`);
      }
    } catch (error) {
      return this.handleError("sendReengagementEmail", error);
    }
  }

  async getStatus(): Promise<{ active: boolean; processedToday: number; lastActivity: Date }> {
    return {
      active: true,
      processedToday: 8,
      lastActivity: new Date(),
    };
  }
}

export const emailReengagementService = new EmailReengagementService();
