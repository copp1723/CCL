import cron from "node-cron";
import { outreachLogger, logBusinessEvent, logPerformance, logError } from "../logger";
import { storage } from "../storage";
import { twilioSms } from "../services/twilio-sms";
import { RealtimeChatAgent } from "../agents/RealtimeChatAgent";
import config from "../config/environment";
import type { Visitor } from "../../shared/schema";

export interface OutreachResult {
  success: boolean;
  visitorId: number;
  channel: "sms" | "email";
  messageId?: string;
  error?: string;
}

export interface OutreachCampaignResult {
  success: boolean;
  processed: number;
  sent: number;
  failed: number;
  results: OutreachResult[];
  processingTime: number;
}

export class OutreachOrchestratorService {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private chatAgent: RealtimeChatAgent;

  constructor() {
    this.chatAgent = new RealtimeChatAgent();
  }

  async initialize(): Promise<void> {
    // Run outreach campaigns every 5 minutes
    const cronExpression = config.isDevelopment()
      ? "*/1 * * * *" // Every 1 minute in dev for testing
      : "*/5 * * * *"; // Every 5 minutes in production

    this.cronJob = cron.schedule(cronExpression, () => this.processOutreachQueue(), {
      scheduled: false, // Don't start immediately
    });

    outreachLogger.info(
      {
        cronExpression,
      },
      "Outreach orchestrator service initialized"
    );
  }

  async start(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.start();
      outreachLogger.info("Outreach orchestrator cron job started");
    }
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      outreachLogger.info("Outreach orchestrator cron job stopped");
    }
  }

  async processOutreachQueue(): Promise<OutreachCampaignResult> {
    if (this.isRunning) {
      outreachLogger.warn("Outreach processing already running, skipping...");
      return {
        success: false,
        processed: 0,
        sent: 0,
        failed: 0,
        results: [],
        processingTime: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let processed = 0;
    let sent = 0;
    let failed = 0;
    const results: OutreachResult[] = [];

    try {
      outreachLogger.info("Starting outreach campaign processing");

      // Get visitors who are flagged for outreach but haven't been contacted yet
      const pendingOutreach = await this.getPendingOutreachVisitors();

      outreachLogger.info(
        {
          count: pendingOutreach.length,
        },
        "Found visitors pending outreach"
      );

      processed = pendingOutreach.length;

      // Process each visitor
      for (const visitor of pendingOutreach) {
        try {
          const result = await this.processVisitorOutreach(visitor);
          results.push(result);

          if (result.success) {
            sent++;
          } else {
            failed++;
          }

          // Small delay between messages to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failed++;
          outreachLogger.error(
            {
              visitorId: visitor.id,
              error,
            },
            "Failed to process visitor outreach"
          );

          results.push({
            success: false,
            visitorId: visitor.id,
            channel: "sms", // Default
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const processingTime = Date.now() - startTime;

      // Log campaign results
      logBusinessEvent("outreach_campaign_completed", {
        processed,
        sent,
        failed,
        processingTime,
        successRate: processed > 0 ? (sent / processed) * 100 : 0,
      });

      logPerformance("outreach_campaign", processingTime, {
        processed,
        sent,
        failed,
      });

      outreachLogger.info(
        {
          processed,
          sent,
          failed,
          processingTime,
          successRate: processed > 0 ? ((sent / processed) * 100).toFixed(2) + "%" : "0%",
        },
        "Outreach campaign completed successfully"
      );

      return {
        success: true,
        processed,
        sent,
        failed,
        results,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError(error as Error, { processingTime }, "Outreach campaign failed");

      return {
        success: false,
        processed,
        sent,
        failed,
        results,
        processingTime,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async getPendingOutreachVisitors(): Promise<Visitor[]> {
    // Get abandoned visitors who:
    // 1. Have been marked as abandoned
    // 2. Have contact information (phone or email)
    // 3. Haven't been contacted yet or need follow-up
    // 4. Return token hasn't expired

    const abandonedVisitors = await storage.getAbandonedVisitors(0); // Get all abandoned
    const pendingOutreach: Visitor[] = [];

    for (const visitor of abandonedVisitors) {
      // Check if visitor has contact method
      const hasContactMethod = visitor.phoneNumber || visitor.email || visitor.emailHash;
      if (!hasContactMethod) continue;

      // Check if return token is still valid
      if (visitor.returnTokenExpiry && new Date() > visitor.returnTokenExpiry) {
        continue; // Token expired
      }

      // Check if we've already contacted this visitor recently
      const recentOutreach = await storage.getOutreachAttemptsByVisitor(visitor.id);
      if (recentOutreach.length > 0) {
        // Check if we should send follow-up based on abandonment step
        const shouldSendFollowup = this.shouldSendFollowup(visitor, recentOutreach);
        if (!shouldSendFollowup) continue;
      }

      pendingOutreach.push(visitor);
    }

    return pendingOutreach;
  }

  private shouldSendFollowup(visitor: Visitor, recentOutreach: any[]): boolean {
    // Simple follow-up logic - in production this would be more sophisticated
    const lastAttempt = recentOutreach[0];
    const hoursSinceLastAttempt =
      (Date.now() - new Date(lastAttempt.sentAt).getTime()) / (1000 * 60 * 60);

    // Send follow-up based on abandonment step and time elapsed
    switch (visitor.abandonmentStep) {
      case 1:
        return hoursSinceLastAttempt >= 2; // 2 hours for initial abandonment
      case 2:
        return hoursSinceLastAttempt >= 6; // 6 hours for form abandonment
      case 3:
        return hoursSinceLastAttempt >= 24; // 24 hours for advanced abandonment
      default:
        return false;
    }
  }

  private async processVisitorOutreach(visitor: Visitor): Promise<OutreachResult> {
    try {
      outreachLogger.info(
        {
          visitorId: visitor.id,
          abandonmentStep: visitor.abandonmentStep,
          hasPhone: !!visitor.phoneNumber,
          hasEmail: !!visitor.email || !!visitor.emailHash,
        },
        "Processing visitor outreach"
      );

      // Determine preferred channel (prioritize SMS for better response rates)
      const channel = visitor.phoneNumber ? "sms" : "email";

      if (channel === "sms" && visitor.phoneNumber) {
        return await this.sendSmsOutreach(visitor);
      } else if (channel === "email" && (visitor.email || visitor.emailHash)) {
        return await this.sendEmailOutreach(visitor);
      } else {
        return {
          success: false,
          visitorId: visitor.id,
          channel: "sms",
          error: "No valid contact method available",
        };
      }
    } catch (error) {
      outreachLogger.error(
        {
          visitorId: visitor.id,
          error,
        },
        "Failed to process visitor outreach"
      );

      return {
        success: false,
        visitorId: visitor.id,
        channel: "sms", // Default
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async sendSmsOutreach(visitor: Visitor): Promise<OutreachResult> {
    try {
      // Use Twilio SMS service to send recovery message
      const smsResult = await twilioSms.sendRecoveryMessage(visitor, visitor.abandonmentStep || 1);

      if (smsResult.success) {
        // Create chat session for potential continuation
        await this.createChatSessionForVisitor(visitor);

        // Log successful outreach
        await storage.createAgentActivity({
          agentName: "OutreachOrchestrator",
          action: "sms_sent",
          details: `SMS outreach sent to visitor ${visitor.id} at abandonment step ${visitor.abandonmentStep}`,
          visitorId: visitor.id,
          status: "success",
        });
      }

      return {
        success: smsResult.success,
        visitorId: visitor.id,
        channel: "sms",
        messageId: smsResult.messageId,
        error: smsResult.error,
      };
    } catch (error) {
      return {
        success: false,
        visitorId: visitor.id,
        channel: "sms",
        error: error instanceof Error ? error.message : "SMS sending failed",
      };
    }
  }

  private async sendEmailOutreach(visitor: Visitor): Promise<OutreachResult> {
    // Placeholder for email outreach - would integrate with SendGrid
    outreachLogger.info(
      {
        visitorId: visitor.id,
      },
      "Email outreach not yet implemented, logging intent"
    );

    // Simulate email sending for now
    await storage.createAgentActivity({
      agentName: "OutreachOrchestrator",
      action: "email_simulated",
      details: `Email outreach simulated for visitor ${visitor.id}`,
      visitorId: visitor.id,
      status: "success",
    });

    return {
      success: true,
      visitorId: visitor.id,
      channel: "email",
      messageId: `email_sim_${Date.now()}`,
    };
  }

  private async createChatSessionForVisitor(visitor: Visitor): Promise<void> {
    try {
      // Create a chat session so when the visitor returns, they can continue
      const sessionId = `recovery_${visitor.id}_${Date.now()}`;

      await storage.createChatSession({
        sessionId,
        visitorId: visitor.id,
        isActive: true,
        agentType: "recovery_chat",
        status: "active",
        messages: [],
      });

      outreachLogger.debug(
        {
          visitorId: visitor.id,
          sessionId,
        },
        "Created chat session for visitor recovery"
      );
    } catch (error) {
      outreachLogger.error(
        {
          visitorId: visitor.id,
          error,
        },
        "Failed to create chat session for visitor"
      );
    }
  }

  // Manual trigger for immediate outreach processing
  async processOutreachNow(): Promise<OutreachCampaignResult> {
    outreachLogger.info("Manual outreach processing triggered");
    return await this.processOutreachQueue();
  }

  // Send specific outreach to a visitor
  async sendSpecificOutreach(
    visitorId: number,
    channel: "sms" | "email" = "sms"
  ): Promise<OutreachResult> {
    try {
      const visitor = await storage.getVisitor(visitorId);
      if (!visitor) {
        return {
          success: false,
          visitorId,
          channel,
          error: "Visitor not found",
        };
      }

      return await this.processVisitorOutreach(visitor);
    } catch (error) {
      return {
        success: false,
        visitorId,
        channel,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get outreach statistics
  async getOutreachStats(): Promise<{
    totalSent: number;
    sentToday: number;
    responseRate: number;
    channelBreakdown: { channel: string; count: number }[];
  }> {
    try {
      // This would be more sophisticated in production
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Simplified stats - in production you'd use proper aggregation queries
      return {
        totalSent: 0, // Would query from outreach_attempts table
        sentToday: 0, // Would query today's outreach_attempts
        responseRate: 0, // Would calculate based on chat sessions created after outreach
        channelBreakdown: [
          { channel: "sms", count: 0 },
          { channel: "email", count: 0 },
        ],
      };
    } catch (error) {
      outreachLogger.error({ error }, "Failed to get outreach stats");
      return {
        totalSent: 0,
        sentToday: 0,
        responseRate: 0,
        channelBreakdown: [],
      };
    }
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Check if messaging services are available
      const twilioHealth = await twilioSms.healthCheck();

      return {
        healthy: twilioHealth.healthy,
        error: twilioHealth.error,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Check if currently processing
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  // Get next run time
  getNextRunTime(): Date | null {
    if (this.cronJob) {
      const now = new Date();
      const nextRun = new Date(
        now.getTime() + (config.isDevelopment() ? 1 * 60 * 1000 : 5 * 60 * 1000)
      );
      return nextRun;
    }
    return null;
  }
}

// Export singleton instance
export const outreachOrchestrator = new OutreachOrchestratorService();
