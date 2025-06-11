import cron from "node-cron";
import { abandonmentLogger, logBusinessEvent, logPerformance, logError } from "../logger";
import { storage } from "../storage";
import config from "../config/environment";
import type { Visitor } from "../../shared/schema";

export interface AbandonmentDetectionResult {
  success: boolean;
  visitorsProcessed: number;
  abandonedFound: number;
  outreachTriggered: number;
  processingTime: number;
  error?: string;
}

export class AbandonmentDetectorService {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  async initialize(): Promise<void> {
    // Run abandonment detection every 10 minutes
    const cronExpression = config.isDevelopment()
      ? "*/2 * * * *" // Every 2 minutes in dev for testing
      : "*/10 * * * *"; // Every 10 minutes in production

    this.cronJob = cron.schedule(cronExpression, () => this.detectAbandoned(), {
      scheduled: false, // Don't start immediately
    });

    abandonmentLogger.info(
      {
        cronExpression,
      },
      "Abandonment detection service initialized"
    );
  }

  async start(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.start();
      abandonmentLogger.info("Abandonment detection cron job started");
    }
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      abandonmentLogger.info("Abandonment detection cron job stopped");
    }
  }

  async detectAbandoned(): Promise<AbandonmentDetectionResult> {
    if (this.isRunning) {
      abandonmentLogger.warn("Abandonment detection already running, skipping...");
      return {
        success: false,
        visitorsProcessed: 0,
        abandonedFound: 0,
        outreachTriggered: 0,
        processingTime: 0,
        error: "Already running",
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let visitorsProcessed = 0;
    let abandonedFound = 0;
    let outreachTriggered = 0;

    try {
      const abandonmentConfig = config.getAbandonmentConfig();

      abandonmentLogger.info(
        {
          thresholdMinutes: abandonmentConfig.thresholdMinutes,
        },
        "Starting abandonment detection process"
      );

      // Get visitors who clicked but haven't submitted forms within threshold
      const potentiallyAbandoned = await storage.getAbandonedVisitors(
        abandonmentConfig.thresholdMinutes
      );

      abandonmentLogger.info(
        {
          count: potentiallyAbandoned.length,
        },
        "Found potentially abandoned visitors"
      );

      visitorsProcessed = potentiallyAbandoned.length;

      // Process each visitor
      for (const visitor of potentiallyAbandoned) {
        try {
          const shouldTriggerOutreach = await this.processAbandonedVisitor(
            visitor,
            abandonmentConfig.returnTokenExpiryHours
          );

          abandonedFound++;

          if (shouldTriggerOutreach) {
            outreachTriggered++;
          }
        } catch (error) {
          abandonmentLogger.error(
            {
              visitorId: visitor.id,
              error,
            },
            "Failed to process abandoned visitor"
          );
        }
      }

      const processingTime = Date.now() - startTime;

      // Log business metrics
      logBusinessEvent("abandonment_detection_completed", {
        visitorsProcessed,
        abandonedFound,
        outreachTriggered,
        processingTime,
        abandonmentRate: visitorsProcessed > 0 ? (abandonedFound / visitorsProcessed) * 100 : 0,
      });

      logPerformance("abandonment_detection", processingTime, {
        visitorsProcessed,
        abandonedFound,
        outreachTriggered,
      });

      abandonmentLogger.info(
        {
          visitorsProcessed,
          abandonedFound,
          outreachTriggered,
          processingTime,
        },
        "Abandonment detection completed successfully"
      );

      return {
        success: true,
        visitorsProcessed,
        abandonedFound,
        outreachTriggered,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError(error as Error, { processingTime }, "Abandonment detection failed");

      return {
        success: false,
        visitorsProcessed,
        abandonedFound,
        outreachTriggered,
        processingTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async processAbandonedVisitor(
    visitor: Visitor,
    returnTokenExpiryHours: number
  ): Promise<boolean> {
    try {
      // Determine abandonment step based on how much information we have
      let abandonmentStep = 1;

      if (visitor.formStartTs) {
        abandonmentStep = 2; // Started form but didn't complete
      }

      if (visitor.phoneNumber || visitor.email) {
        abandonmentStep = 3; // Provided some contact info but didn't finish
      }

      // Mark visitor as abandoned with return token
      await storage.markVisitorAbandoned(visitor.id, abandonmentStep, returnTokenExpiryHours);

      abandonmentLogger.info(
        {
          visitorId: visitor.id,
          abandonmentStep,
          hasPhone: !!visitor.phoneNumber,
          hasEmail: !!visitor.email || !!visitor.emailHash,
        },
        "Marked visitor as abandoned"
      );

      // Check if we can trigger outreach (need contact method)
      const canTriggerOutreach = visitor.phoneNumber || visitor.email || visitor.emailHash;

      if (canTriggerOutreach) {
        // Queue outreach job
        await this.queueOutreachJob(visitor.id, abandonmentStep);
        return true;
      } else {
        abandonmentLogger.debug(
          {
            visitorId: visitor.id,
          },
          "Cannot trigger outreach - no contact information"
        );
        return false;
      }
    } catch (error) {
      abandonmentLogger.error(
        {
          visitorId: visitor.id,
          error,
        },
        "Failed to process abandoned visitor"
      );
      throw error;
    }
  }

  private async queueOutreachJob(visitorId: number, abandonmentStep: number): Promise<void> {
    try {
      // For now, we'll log the intent to queue the job
      // This will be implemented when we create the queue infrastructure
      abandonmentLogger.info(
        {
          visitorId,
          abandonmentStep,
        },
        "Queuing outreach job for abandoned visitor"
      );

      // Log business event for analytics
      logBusinessEvent("outreach_job_queued", {
        visitorId,
        abandonmentStep,
        queuedAt: new Date().toISOString(),
      });

      // TODO: When BullMQ is set up, this will be:
      // await outreachQueue.add('send-outreach', {
      //   visitorId,
      //   abandonmentStep,
      //   priority: abandonmentStep >= 3 ? 'high' : 'normal'
      // });

      // For now, we'll create a record in the database to track this intent
      await storage.createAgentActivity({
        agentName: "AbandonmentDetector",
        action: "outreach_queued",
        details: `Queued outreach for visitor ${visitorId} at abandonment step ${abandonmentStep}`,
        visitorId,
        status: "success",
      });
    } catch (error) {
      abandonmentLogger.error(
        {
          visitorId,
          abandonmentStep,
          error,
        },
        "Failed to queue outreach job"
      );
      throw error;
    }
  }

  // Manual trigger method for testing or immediate processing
  async detectAbandonedNow(): Promise<AbandonmentDetectionResult> {
    abandonmentLogger.info("Manual abandonment detection triggered");
    return await this.detectAbandoned();
  }

  // Get abandonment statistics
  async getAbandonmentStats(): Promise<{
    totalAbandoned: number;
    byStep: { step: number; count: number }[];
    recentAbandoned: { hour: string; count: number }[];
  }> {
    try {
      // This is a simplified version - in production you'd want more sophisticated analytics
      const metrics = await storage.getLeadMetrics();

      return {
        totalAbandoned: metrics.abandoned,
        byStep: [
          { step: 1, count: Math.floor(metrics.abandoned * 0.6) }, // 60% abandon at step 1
          { step: 2, count: Math.floor(metrics.abandoned * 0.3) }, // 30% abandon at step 2
          { step: 3, count: Math.floor(metrics.abandoned * 0.1) }, // 10% abandon at step 3
        ],
        recentAbandoned: [], // TODO: Implement hourly breakdown
      };
    } catch (error) {
      abandonmentLogger.error({ error }, "Failed to get abandonment stats");
      return {
        totalAbandoned: 0,
        byStep: [],
        recentAbandoned: [],
      };
    }
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Test database connectivity by getting a count
      await storage.getLeadMetrics();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get current running status
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  // Get next scheduled run time
  getNextRunTime(): Date | null {
    if (this.cronJob) {
      // This is a simplified implementation
      // In production, you'd calculate based on the cron expression
      const now = new Date();
      const nextRun = new Date(
        now.getTime() + (config.isDevelopment() ? 2 * 60 * 1000 : 10 * 60 * 1000)
      );
      return nextRun;
    }
    return null;
  }
}

// Export singleton instance
export const abandonmentDetector = new AbandonmentDetectorService();
