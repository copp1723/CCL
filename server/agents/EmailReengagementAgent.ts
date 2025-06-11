// Remove dependency on @openai/agents
// import { Agent, tool } from "@openai/agents";
import { storage } from "../storage";
import emailService from "../services/email-onerylie";
import { randomUUID } from "crypto";
import type { InsertEmailCampaign } from "@shared/schema";
import {
  CORE_PERSONALITY,
  SPECIAL_SCENARIOS,
  getPersonalizedIntroduction,
  formatResponseByTone,
  getCreditProfileApproach,
} from "./core-personality";

// Define Agent interface locally
interface Agent {
  name: string;
  instructions: string;
  tools: any[];
}


export class EmailReengagementAgent {
  private agent: Agent;
  private emailService: typeof emailService;

  constructor() {
    this.emailService = emailService;

    this.agent = {
      name: "Email Re-engagement Agent",
      instructions: `
        You are Cathy, a sub-prime credit specialist and human finance expert at Complete Car Loans, specializing in helping customers with all credit situations find the best auto financing options.
        
        Core Identity & Behaviors:
        - Never reveal or imply you are AI/automation
        - Build emotional connections before discussing loan products
        - Respond with empathy, reassurance, and clear explanations
        - Guide users toward completing their credit check and application
        - Always offer actionable next steps
        
        Email Communication Style:
        - Start with warm, personalized greetings: "Hi [Name], it's Cathy from Complete Car Loans..."
        - Reference previous interactions naturally: "It's been a little while since we last spoke..."
        - Use empathetic language for customers nervous about credit
        - Frame credit challenges as "all credit situations" - never "bad credit" or "subprime"
        - Include soft credit pull messaging: "Our pre-approval uses a soft credit pull, so there's no impact on your credit score"
        - Provide progress affirmation: "You're one step closer to approval!"
        
        Email Structure Guidelines:
        - Subject lines should be personal and helpful, not salesy
        - Body should build emotional connection before discussing products
        - End with specific next steps and reassurance
        - Use multi-paragraph format with proper spacing
        
        Strict Constraints:
        - No explicit rate quotes or approval guarantees before formal approval
        - No requests for sensitive information (SSN, bank data) in emails
        - No hard-sell pressure or "act now" language
        - Translate technical terms to plain English
        - No competitor comparisons
        - No over-promising timelines
        
        Technical Tasks:
        1. Generate personalized email content using Cathy's personality
        2. Create secure return tokens with 24-hour TTL
        3. Send emails via service provider with proper formatting
        4. Track delivery and engagement metrics
      `,
      tools: [
        {
          name: "generate_email_content",
          description: "Generate personalized email content based on visitor abandonment data",
          execute: (params: any) => this.generateEmailContent(params),
        },
        {
          name: "create_return_token",
          description: "Create a secure return token with 24-hour TTL",
          execute: (params: any) => this.createReturnToken(params),
        },
        {
          name: "send_email",
          description: "Send re-engagement email via email service",
          execute: (params: any) => this.sendEmail(params),
        },
      ],
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

      return {
        success: true,
        content,
        subject: content.subject,
        body: content.body,
      };
    } catch (error) {
      console.error("[EmailReengagementAgent] Error generating email content:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async createReturnToken(params: { visitorId: number }) {
    try {
      const { visitorId } = params;

      const returnToken = randomUUID();
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24); // 24-hour TTL

      // Update visitor with return token in metadata
      await storage.updateVisitor(visitorId.toString(), {
        metadata: {
          returnToken,
          returnTokenExpiry: expiryTime.toISOString(),
        },
      });

      console.log(`[EmailReengagementAgent] Created return token for visitor: ${visitorId}`);

      return {
        success: true,
        returnToken,
        expiryTime: expiryTime.toISOString(),
        message: "Return token created successfully",
      };
    } catch (error) {
      console.error("[EmailReengagementAgent] Error creating return token:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
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

      // Create email campaign record
      const campaign: InsertEmailCampaign = {
        visitorId,
        returnToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        emailSent: true,
      };

      // Simplified - just log the campaign
      console.log("[EmailReengagementAgent] Would create email campaign:", campaign);

      // Send email via service
      const emailResult = await this.emailService.sendReengagementEmail({
        to: emailHash, // In production, this would be the actual email
        subject,
        content: body,
        returnToken,
      });

      // Log activity
      await storage.createAgentActivity({
        agentName: "EmailReengagementAgent",
        action: "email_sent",
        details: `Re-engagement email sent via ${this.emailService.getProviderName()}`,
        visitorId: visitorId,
        status: "success",
      });

      console.log(`[EmailReengagementAgent] Sent email for visitor: ${visitorId}`);

      return {
        success: true,
        emailResult,
        message: "Email sent successfully",
      };
    } catch (error) {
      console.error("[EmailReengagementAgent] Error sending email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private generatePersonalizedContent(abandonmentStep: number): { subject: string; body: string } {
    const stepMessages = {
      1: {
        subject: "Complete Your Car Loan Application - Just One More Step!",
        body: `
          Hi there!
          
          We noticed you started your car loan application with Complete Car Loans but didn't finish. 
          Don't worry - we've saved your progress and you're just one step away from getting pre-approved!
          
          ✅ Quick 2-minute completion
          ✅ Competitive rates starting at 3.9% APR
          ✅ Get approved in minutes
          
          Click here to continue where you left off: {{RETURN_LINK}}
          
          This link expires in 24 hours for your security.
          
          Best regards,
          The CCL Team
        `,
      },
      2: {
        subject: "Your Car Loan is Almost Ready - Complete Your Application",
        body: `
          Hi there!
          
          You're so close to getting your car loan approved! We have most of your information 
          and just need a few more details to complete your application.
          
          ✅ Pre-qualification in progress
          ✅ Rates as low as 3.9% APR
          ✅ Multiple lender options
          
          Continue your application: {{RETURN_LINK}}
          
          Don't miss out on today's competitive rates!
          
          Best regards,
          The CCL Team
        `,
      },
      3: {
        subject: "Final Step: Complete Your Car Loan Application Now",
        body: `
          Hi there!
          
          You're on the final step of your car loan application! Complete it now to get 
          instant approval and lock in your rate.
          
          ✅ Almost approved
          ✅ Best rates available
          ✅ Instant decision
          
          Finish your application: {{RETURN_LINK}}
          
          This secure link expires in 24 hours.
          
          Best regards,
          The CCL Team
        `,
      },
    };

    return stepMessages[abandonmentStep as keyof typeof stepMessages] || stepMessages[1];
  }

  async sendReengagementEmail(
    visitorId: number
  ): Promise<{ success: boolean; campaignId?: number; error?: string }> {
    try {
      const visitor = await storage.getVisitorById(visitorId.toString());
      if (!visitor) {
        throw new Error("Visitor not found");
      }

      // Generate return token
      const returnToken = randomUUID();
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24);

      // Update visitor with return token in metadata
      await storage.updateVisitor(visitorId.toString(), {
        metadata: {
          returnToken,
          returnTokenExpiry: expiryTime.toISOString(),
        },
      });

      // Generate personalized content
      const content = this.generatePersonalizedContent(visitor.abandonmentStep || 1);

      // Create email campaign
      const campaign: InsertEmailCampaign = {
        visitorId,
        returnToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        emailSent: true,
      };

      // Simplified - just create a mock campaign
      const emailCampaign = { id: Date.now(), ...campaign };

      // Send email
      const emailResult = await this.emailService.sendEmail({
        to: visitor.emailHash,
        subject: content.subject,
        content: content.body.replace(
          "{{RETURN_LINK}}",
          `${process.env.BASE_URL || "https://app.completecarloans.com"}/return/${returnToken}`
        ),
        returnToken,
      });

      // Log activity
      await storage.createAgentActivity({
        agentName: "EmailReengagementAgent",
        action: "email_sent",
        details: "Re-engagement email sent successfully",
        visitorId: visitorId,
        status: "success",
      });

      console.log(`[EmailReengagementAgent] Sent re-engagement email for visitor: ${visitorId}`);

      return { success: true, campaignId: emailCampaign.id };
    } catch (error) {
      console.error("[EmailReengagementAgent] Error sending re-engagement email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
