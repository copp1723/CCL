import axios, { AxiosResponse } from "axios";
import { BoberdooSubmission, BoberdooSubmissionSchema } from "../../shared/validation/schemas";
import config from "../config/environment";
import { logger } from "../logger";

interface BoberdooResponse {
  success: boolean;
  leadId?: string;
  status?: "accepted" | "rejected" | "pending";
  price?: number;
  buyerId?: string;
  message?: string;
  errorCode?: string;
  errorDetails?: string;
}

interface HealthCheckResult {
  healthy: boolean;
  configured: boolean;
  error?: string;
  lastSuccessfulSubmission?: Date;
  responseTime?: number;
}

interface ServiceInfo {
  url: string;
  vendorId: string;
  timeoutMs: number;
  configured: boolean;
  submissionCount: number;
  successCount: number;
  failureCount: number;
}

class BoberdooService {
  private config = config.getBoberdooConfig();
  private logger = logger.child({ component: "BoberdooService" });

  // Performance metrics
  private submissionCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private lastSuccessfulSubmission?: Date;

  // Queue for failed submissions (simple in-memory for MVP)
  private deadLetterQueue: Array<{
    submission: BoberdooSubmission;
    attempts: number;
    lastAttempt: Date;
    errors: string[];
  }> = [];

  constructor() {
    this.logger.info("Boberdoo service initialized", {
      configured: this.config.configured,
      url: this.config.url,
      vendorId: this.config.vendorId,
    });
  }

  /**
   * Submit a lead to Boberdoo marketplace
   */
  async submitLead(submission: BoberdooSubmission): Promise<BoberdooResponse> {
    if (!this.config.configured) {
      throw new Error("Boberdoo service not configured");
    }

    // Validate submission data
    const validationResult = BoberdooSubmissionSchema.safeParse(submission);
    if (!validationResult.success) {
      this.logger.warn("Invalid submission data", {
        leadId: submission.lead_id,
        errors: validationResult.error.flatten(),
      });
      throw new Error(`Invalid submission data: ${validationResult.error.message}`);
    }

    const startTime = Date.now();
    this.submissionCount++;

    try {
      this.logger.info("Submitting lead to Boberdoo", {
        leadId: submission.lead_id,
        vendorId: submission.vendor_id,
        source: submission.source,
      });

      const response = await this.makeHttpRequest(validationResult.data);
      const result = this.parseResponse(response, submission.lead_id);

      if (result.success) {
        this.successCount++;
        this.lastSuccessfulSubmission = new Date();
        this.logger.info("Lead submitted successfully", {
          leadId: submission.lead_id,
          status: result.status,
          price: result.price,
          buyerId: result.buyerId,
          responseTime: Date.now() - startTime,
        });
      } else {
        this.failureCount++;
        this.logger.warn("Lead submission failed", {
          leadId: submission.lead_id,
          errorCode: result.errorCode,
          message: result.message,
          responseTime: Date.now() - startTime,
        });
      }

      return result;
    } catch (error) {
      this.failureCount++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Lead submission error", {
        leadId: submission.lead_id,
        error: errorMessage,
        responseTime: Date.now() - startTime,
      });

      // Add to dead letter queue for retry
      this.addToDeadLetterQueue(submission, errorMessage);

      throw new Error(`Failed to submit lead: ${errorMessage}`);
    }
  }

  /**
   * Submit lead with automatic retry logic
   */
  async submitLeadWithRetry(
    submission: BoberdooSubmission,
    maxAttempts: number = 3
  ): Promise<BoberdooResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.submitLead(submission);

        if (result.success || result.status === "rejected") {
          // Don't retry on rejection - it's a valid response
          return result;
        }

        // If not successful but not rejected, retry
        if (attempt < maxAttempts) {
          const delay = this.calculateBackoffDelay(attempt);
          this.logger.info(`Retrying lead submission after ${delay}ms`, {
            leadId: submission.lead_id,
            attempt,
            maxAttempts,
          });
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        if (attempt < maxAttempts) {
          const delay = this.calculateBackoffDelay(attempt);
          this.logger.warn(`Lead submission failed, retrying in ${delay}ms`, {
            leadId: submission.lead_id,
            attempt,
            maxAttempts,
            error: lastError.message,
          });
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    if (lastError) {
      throw lastError;
    }

    throw new Error("Lead submission failed after all retry attempts");
  }

  /**
   * Make HTTP request to Boberdoo API
   */
  private async makeHttpRequest(submission: BoberdooSubmission): Promise<AxiosResponse> {
    return await axios.post(this.config.url!, submission, {
      timeout: this.config.timeoutMs,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "CCL-MVP-Pipeline/1.0.0",
        Accept: "application/json",
      },
      // Boberdoo typically expects form-encoded data
      transformRequest: [
        data => {
          const params = new URLSearchParams();
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });
          return params.toString();
        },
      ],
    });
  }

  /**
   * Parse Boberdoo API response
   */
  private parseResponse(response: AxiosResponse, leadId: string): BoberdooResponse {
    try {
      const data = response.data;

      // Handle successful responses
      if (response.status === 200) {
        // Boberdoo typically returns different formats
        if (typeof data === "string") {
          // Parse text responses (e.g., "SUCCESS:12345:ACCEPTED:25.00")
          return this.parseTextResponse(data, leadId);
        } else if (typeof data === "object") {
          // Parse JSON responses
          return this.parseJsonResponse(data, leadId);
        }
      }

      // Handle error responses
      return {
        success: false,
        errorCode: `HTTP_${response.status}`,
        message: `HTTP ${response.status}: ${response.statusText}`,
        errorDetails: JSON.stringify(data),
      };
    } catch (error) {
      this.logger.error("Failed to parse Boberdoo response", {
        leadId,
        error: error instanceof Error ? error.message : "Unknown error",
        responseData: response.data,
      });

      return {
        success: false,
        errorCode: "PARSE_ERROR",
        message: "Failed to parse response from Boberdoo",
        errorDetails: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse text-based response from Boberdoo
   */
  private parseTextResponse(text: string, leadId: string): BoberdooResponse {
    const parts = text.split(":");

    if (parts[0] === "SUCCESS" && parts.length >= 3) {
      return {
        success: true,
        leadId: parts[1],
        status: parts[2].toLowerCase() as "accepted" | "rejected" | "pending",
        price: parts[3] ? parseFloat(parts[3]) : undefined,
        buyerId: parts[4] || undefined,
      };
    }

    if (parts[0] === "ERROR") {
      return {
        success: false,
        errorCode: parts[1] || "UNKNOWN_ERROR",
        message: parts[2] || "Unknown error from Boberdoo",
      };
    }

    // Handle other text responses
    return {
      success: false,
      errorCode: "UNKNOWN_RESPONSE",
      message: `Unexpected response format: ${text}`,
    };
  }

  /**
   * Parse JSON response from Boberdoo
   */
  private parseJsonResponse(data: any, leadId: string): BoberdooResponse {
    if (data.status === "success" || data.success === true) {
      return {
        success: true,
        leadId: data.lead_id || data.leadId || leadId,
        status: data.lead_status || data.status || "pending",
        price: data.price ? parseFloat(data.price) : undefined,
        buyerId: data.buyer_id || data.buyerId,
        message: data.message,
      };
    }

    return {
      success: false,
      errorCode: data.error_code || data.errorCode || "API_ERROR",
      message: data.message || data.error_message || "Unknown error",
      errorDetails: JSON.stringify(data),
    };
  }

  /**
   * Add failed submission to dead letter queue
   */
  private addToDeadLetterQueue(submission: BoberdooSubmission, error: string): void {
    const existingEntry = this.deadLetterQueue.find(
      entry => entry.submission.lead_id === submission.lead_id
    );

    if (existingEntry) {
      existingEntry.attempts++;
      existingEntry.lastAttempt = new Date();
      existingEntry.errors.push(error);
    } else {
      this.deadLetterQueue.push({
        submission,
        attempts: 1,
        lastAttempt: new Date(),
        errors: [error],
      });
    }

    // Limit DLQ size (keep last 1000 failed submissions)
    if (this.deadLetterQueue.length > 1000) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-1000);
    }
  }

  /**
   * Get dead letter queue entries for manual review
   */
  getDeadLetterQueue() {
    return this.deadLetterQueue.map(entry => ({
      leadId: entry.submission.lead_id,
      attempts: entry.attempts,
      lastAttempt: entry.lastAttempt,
      errors: entry.errors,
      canRetry: entry.attempts < 5 && Date.now() - entry.lastAttempt.getTime() > 300000, // 5 minutes
    }));
  }

  /**
   * Retry failed submission from dead letter queue
   */
  async retryFromDeadLetterQueue(leadId: string): Promise<BoberdooResponse> {
    const entryIndex = this.deadLetterQueue.findIndex(entry => entry.submission.lead_id === leadId);

    if (entryIndex === -1) {
      throw new Error(`Lead ${leadId} not found in dead letter queue`);
    }

    const entry = this.deadLetterQueue[entryIndex];

    try {
      const result = await this.submitLead(entry.submission);

      if (result.success) {
        // Remove from DLQ on success
        this.deadLetterQueue.splice(entryIndex, 1);
      }

      return result;
    } catch (error) {
      // Update DLQ entry with new error
      entry.attempts++;
      entry.lastAttempt = new Date();
      entry.errors.push(error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.round(delay + jitter);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for Boberdoo service
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.config.configured) {
      return {
        healthy: false,
        configured: false,
        error: "Boberdoo service not configured",
      };
    }

    try {
      const startTime = Date.now();

      // Make a test connection (without submitting data)
      const testResponse = await axios.get(this.config.url!, {
        timeout: Math.min(this.config.timeoutMs, 5000), // Shorter timeout for health check
        validateStatus: () => true, // Don't throw on 4xx/5xx
      });

      const responseTime = Date.now() - startTime;

      // Consider it healthy if we can connect (even if we get error responses)
      const healthy = testResponse.status < 500;

      return {
        healthy,
        configured: true,
        lastSuccessfulSubmission: this.lastSuccessfulSubmission,
        responseTime,
      };
    } catch (error) {
      return {
        healthy: false,
        configured: true,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get service information and statistics
   */
  getServiceInfo(): ServiceInfo {
    return {
      url: this.config.url || "",
      vendorId: this.config.vendorId || "",
      timeoutMs: this.config.timeoutMs,
      configured: this.config.configured,
      submissionCount: this.submissionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
    };
  }

  /**
   * Get service statistics
   */
  getStats() {
    const successRate =
      this.submissionCount > 0 ? (this.successCount / this.submissionCount) * 100 : 0;

    return {
      submissionCount: this.submissionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: parseFloat(successRate.toFixed(2)),
      deadLetterQueueSize: this.deadLetterQueue.length,
      lastSuccessfulSubmission: this.lastSuccessfulSubmission,
      configured: this.config.configured,
    };
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.submissionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.lastSuccessfulSubmission = undefined;
    this.deadLetterQueue = [];
  }
}

// Singleton instance
export const boberdooService = new BoberdooService();

// Default export
export default boberdooService;
