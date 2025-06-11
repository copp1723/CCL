import twilio from "twilio";
import config from "../config/environment";
import { outreachLogger, logBusinessEvent, logError, safeLogVisitor } from "../logger";
import { storage } from "../storage";
import type { Visitor } from "../../shared/schema";

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
  segments?: number;
}

export interface SmsMessage {
  to: string;
  message: string;
  returnToken?: string;
  visitorId?: number;
  priority?: "low" | "normal" | "high";
}

export class TwilioSmsService {
  private client: twilio.Twilio | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const messagingConfig = config.getMessagingConfig();

    if (messagingConfig.twilio.configured) {
      try {
        this.client = twilio(messagingConfig.twilio.accountSid!, messagingConfig.twilio.authToken!);
        this.isConfigured = true;
        outreachLogger.info("Twilio SMS service initialized successfully");
      } catch (error) {
        outreachLogger.error({ error }, "Failed to initialize Twilio client");
        this.isConfigured = false;
      }
    } else {
      outreachLogger.warn("Twilio not configured - SMS service unavailable");
    }
  }

  async sendSms(smsMessage: SmsMessage): Promise<SmsResult> {
    if (!this.isConfigured || !this.client) {
      return {
        success: false,
        error: "Twilio SMS service not configured",
      };
    }

    const messagingConfig = config.getMessagingConfig();
    const startTime = Date.now();

    try {
      // Validate phone number format
      const formattedPhone = this.formatPhoneNumber(smsMessage.to);
      if (!formattedPhone) {
        return {
          success: false,
          error: "Invalid phone number format",
        };
      }

      // Add return link if return token provided
      let messageBody = smsMessage.message;
      if (smsMessage.returnToken) {
        const returnUrl = this.generateReturnUrl(smsMessage.returnToken);
        messageBody += `\n\nContinue your application: ${returnUrl}`;
      }

      // Send SMS via Twilio
      const message = await this.client.messages.create({
        body: messageBody,
        from: messagingConfig.twilio.outboundNumber,
        to: formattedPhone,
        // Add callback URL for delivery status
        statusCallback: `${this.getBaseUrl()}/api/webhooks/twilio/status`,
        // Track opens if return URL provided
        ...(smsMessage.returnToken && {
          provideFeedback: true,
        }),
      });

      const processingTime = Date.now() - startTime;

      // Log successful SMS send
      outreachLogger.info(
        {
          messageId: message.sid,
          to: this.maskPhoneNumber(formattedPhone),
          visitorId: smsMessage.visitorId,
          segments: message.numSegments ? parseInt(message.numSegments) : 1,
          cost: message.price ? parseFloat(message.price) : undefined,
          processingTime,
        },
        "SMS sent successfully"
      );

      // Store outreach attempt in database
      if (smsMessage.visitorId) {
        await this.recordOutreachAttempt(smsMessage, message.sid, "sent");
      }

      // Log business event
      logBusinessEvent("sms_sent", {
        messageId: message.sid,
        visitorId: smsMessage.visitorId,
        segments: message.numSegments ? parseInt(message.numSegments) : 1,
        hasReturnToken: !!smsMessage.returnToken,
        processingTime,
      });

      return {
        success: true,
        messageId: message.sid,
        cost: message.price ? parseFloat(message.price) : undefined,
        segments: message.numSegments ? parseInt(message.numSegments) : 1,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      outreachLogger.error(
        {
          error,
          to: this.maskPhoneNumber(smsMessage.to),
          visitorId: smsMessage.visitorId,
          processingTime,
        },
        "Failed to send SMS"
      );

      // Record failed attempt
      if (smsMessage.visitorId) {
        await this.recordOutreachAttempt(
          smsMessage,
          undefined,
          "failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error sending SMS",
      };
    }
  }

  async sendBulkSms(messages: SmsMessage[]): Promise<{
    sent: number;
    failed: number;
    results: SmsResult[];
    totalCost: number;
  }> {
    const results: SmsResult[] = [];
    let sent = 0;
    let failed = 0;
    let totalCost = 0;

    outreachLogger.info({ messageCount: messages.length }, "Starting bulk SMS send");

    // Process messages with rate limiting (Twilio allows 100 requests/second)
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const batchPromises = batch.map(async message => {
        const result = await this.sendSms(message);
        if (result.success) {
          sent++;
          totalCost += result.cost || 0;
        } else {
          failed++;
        }
        return result;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map(r =>
          r.status === "fulfilled" ? r.value : { success: false, error: "Promise rejected" }
        )
      );

      // Rate limiting delay between batches
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    outreachLogger.info(
      {
        total: messages.length,
        sent,
        failed,
        totalCost,
        successRate: ((sent / messages.length) * 100).toFixed(2),
      },
      "Bulk SMS send completed"
    );

    return { sent, failed, results, totalCost };
  }

  async handleDeliveryStatus(twilioWebhook: any): Promise<void> {
    try {
      const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = twilioWebhook;

      outreachLogger.info(
        {
          messageId: MessageSid,
          status: MessageStatus,
          to: this.maskPhoneNumber(To),
          errorCode: ErrorCode,
          errorMessage: ErrorMessage,
        },
        "Received Twilio delivery status"
      );

      // Update outreach attempt in database
      const outreachAttempts = await storage.getOutreachAttemptsByExternalId(MessageSid);
      if (outreachAttempts.length > 0) {
        const attempt = outreachAttempts[0];

        const updateData: any = {
          status: this.mapTwilioStatus(MessageStatus),
        };

        if (MessageStatus === "delivered") {
          updateData.deliveredAt = new Date();
        } else if (MessageStatus === "failed" || MessageStatus === "undelivered") {
          updateData.errorMessage = ErrorMessage || `Error code: ${ErrorCode}`;
        }

        await storage.updateOutreachAttempt(attempt.id, updateData);

        // Log business event for analytics
        logBusinessEvent("sms_status_update", {
          messageId: MessageSid,
          visitorId: attempt.visitorId,
          status: MessageStatus,
          errorCode: ErrorCode,
        });
      }
    } catch (error) {
      logError(
        error as Error,
        { webhook: twilioWebhook },
        "Failed to handle Twilio delivery status"
      );
    }
  }

  async sendRecoveryMessage(visitor: Visitor, abandonmentStep: number): Promise<SmsResult> {
    if (!visitor.phoneNumber) {
      return {
        success: false,
        error: "No phone number available for visitor",
      };
    }

    // Generate empathetic recovery message based on abandonment step
    const message = this.generateRecoveryMessage(visitor, abandonmentStep);

    return await this.sendSms({
      to: visitor.phoneNumber,
      message,
      returnToken: visitor.returnToken || undefined,
      visitorId: visitor.id,
      priority: abandonmentStep >= 3 ? "high" : "normal",
    });
  }

  private generateRecoveryMessage(visitor: Visitor, abandonmentStep: number): string {
    const firstName = visitor.firstName || "there";
    const baseMessages = {
      1: `Hi ${firstName}! This is Cathy from Complete Car Loans. I noticed you were checking out auto financing options. I specialize in helping people get approved regardless of credit history. Would you like me to check your pre-approval status? It takes just 60 seconds and won't affect your credit score.`,

      2: `Hi ${firstName}! It's Cathy from Complete Car Loans. I see you started your application but got interrupted - that happens to all of us! The good news is I saved your progress. I can get you pre-approved in the next 2 minutes. Ready to finish up?`,

      3: `${firstName}, it's Cathy from Complete Car Loans. You were so close to completing your pre-approval! I know these applications can feel overwhelming, but you're literally 1-2 questions away from getting your financing confirmed. I'm here to help make this super easy for you.`,
    };

    return baseMessages[abandonmentStep as keyof typeof baseMessages] || baseMessages[1];
  }

  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, "");

    // Format to E.164 if it's a valid US number
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+${cleaned}`;
    } else if (phone.startsWith("+1") && cleaned.length === 11) {
      return phone; // Already in E.164 format
    }

    return null; // Invalid format
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length > 4) {
      return phone.slice(0, -4) + "****";
    }
    return "****";
  }

  private generateReturnUrl(returnToken: string): string {
    const baseUrl = this.getBaseUrl();
    return `${baseUrl}/continue?token=${returnToken}`;
  }

  private getBaseUrl(): string {
    // In production, this would come from environment config
    const env = config.get();
    if (env.NODE_ENV === "production") {
      return process.env.APP_BASE_URL || "https://app.completecarloans.com";
    }
    return `http://localhost:${env.PORT}`;
  }

  private mapTwilioStatus(twilioStatus: string): string {
    const statusMap: Record<string, string> = {
      queued: "sent",
      sending: "sent",
      sent: "sent",
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
      received: "clicked", // For when user responds
    };

    return statusMap[twilioStatus] || "sent";
  }

  private async recordOutreachAttempt(
    smsMessage: SmsMessage,
    messageId?: string,
    status: string = "sent",
    errorMessage?: string
  ): Promise<void> {
    if (!smsMessage.visitorId) return;

    try {
      await storage.createOutreachAttempt({
        visitorId: smsMessage.visitorId,
        channel: "sms",
        messageContent: smsMessage.message,
        externalMessageId: messageId || null,
        status,
        returnToken: smsMessage.returnToken || null,
        errorMessage: errorMessage || null,
        metadata: {
          priority: smsMessage.priority || "normal",
          sentVia: "twilio",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      outreachLogger.error(
        { error, visitorId: smsMessage.visitorId },
        "Failed to record outreach attempt"
      );
    }
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    if (!this.isConfigured || !this.client) {
      return { healthy: false, error: "Twilio not configured" };
    }

    try {
      // Test connection by fetching account info
      await this.client.api.accounts.list({ limit: 1 });
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown Twilio error",
      };
    }
  }

  // Get service info for monitoring
  getServiceInfo(): {
    configured: boolean;
    outboundNumber?: string;
    accountSid?: string;
  } {
    const messagingConfig = config.getMessagingConfig();
    return {
      configured: this.isConfigured,
      outboundNumber: messagingConfig.twilio.outboundNumber,
      accountSid: messagingConfig.twilio.accountSid?.substring(0, 8) + "****", // Masked for security
    };
  }

  // Check if phone number is valid for SMS
  isValidPhoneNumber(phone: string): boolean {
    return this.formatPhoneNumber(phone) !== null;
  }

  // Get estimated SMS cost (based on US rates)
  estimateSmsSegments(message: string): number {
    // SMS segments: 160 chars for GSM, 70 chars for Unicode
    const isUnicode = /[^\x00-\x7F]/.test(message);
    const segmentSize = isUnicode ? 70 : 160;
    return Math.ceil(message.length / segmentSize);
  }
}

// Export singleton instance
export const twilioSms = new TwilioSmsService();
