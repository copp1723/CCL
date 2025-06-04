import type { LeadPackage } from '../agents/LeadPackagingAgent';

export interface WebhookSubmissionResult {
  success: boolean;
  response?: any;
  error?: string;
  statusCode?: number;
}

export class WebhookService {
  private dealerCrmUrl: string;
  private retryAttempts: number;
  private timeoutMs: number;

  constructor() {
    this.dealerCrmUrl = process.env.DEALER_CRM_WEBHOOK_URL || 'https://crm.example.com/api/leads';
    this.retryAttempts = 3;
    this.timeoutMs = 10000; // 10 seconds
  }

  async submitToDealerCrm(leadPackage: LeadPackage): Promise<WebhookSubmissionResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[WebhookService] Submitting lead to dealer CRM (attempt ${attempt}/${this.retryAttempts})`);
        console.log(`[WebhookService] Lead ID: ${leadPackage.leadId}`);
        
        const result = await this.sendWebhookRequest(leadPackage);
        
        if (result.success) {
          console.log(`[WebhookService] Successfully submitted lead: ${leadPackage.leadId}`);
          return result;
        } else if (result.statusCode && result.statusCode >= 500) {
          // Retry on 5xx errors
          lastError = new Error(`Server error: ${result.statusCode}`);
          console.log(`[WebhookService] Server error (${result.statusCode}), retrying...`);
          await this.delay(1000 * attempt); // Exponential backoff
          continue;
        } else {
          // Don't retry on 4xx errors
          console.error(`[WebhookService] Client error (${result.statusCode}): ${result.error}`);
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[WebhookService] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.retryAttempts) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }
    
    console.error(`[WebhookService] All attempts failed for lead: ${leadPackage.leadId}`);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
    };
  }

  private async sendWebhookRequest(leadPackage: LeadPackage): Promise<WebhookSubmissionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    
    try {
      // In production, this would call the actual dealer CRM webhook
      if (this.dealerCrmUrl.includes('example.com')) {
        return await this.mockWebhookRequest(leadPackage);
      }

      const response = await fetch(this.dealerCrmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEALER_CRM_API_KEY || 'mock_key'}`,
          'User-Agent': 'CCL-Agents/1.0.0',
        },
        body: JSON.stringify(this.formatLeadForCrm(leadPackage)),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          response: responseData,
          statusCode: response.status,
        };
      } else {
        return {
          success: false,
          error: responseData.message || response.statusText,
          statusCode: response.status,
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          statusCode: 408,
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      };
    }
  }

  private async mockWebhookRequest(leadPackage: LeadPackage): Promise<WebhookSubmissionResult> {
    console.log('[WebhookService] Using mock dealer CRM webhook');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate success/failure rates
    const random = Math.random();
    
    if (random < 0.9) {
      // 90% success rate
      return {
        success: true,
        response: {
          leadId: leadPackage.leadId,
          crmId: `CRM-${Date.now()}`,
          status: 'received',
          timestamp: new Date().toISOString(),
        },
        statusCode: 200,
      };
    } else if (random < 0.95) {
      // 5% rate of 5xx errors (retryable)
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    } else {
      // 5% rate of 4xx errors (non-retryable)
      return {
        success: false,
        error: 'Invalid lead data format',
        statusCode: 400,
      };
    }
  }

  private formatLeadForCrm(leadPackage: LeadPackage): any {
    // Format lead package for dealer CRM API
    return {
      lead_id: leadPackage.leadId,
      contact: {
        email_hash: leadPackage.visitor.emailHash,
        phone: leadPackage.visitor.phoneNumber,
      },
      application: {
        abandonment_step: leadPackage.visitor.abandonmentStep,
        session_id: leadPackage.visitor.sessionId,
      },
      credit: {
        approved: leadPackage.creditCheck.approved,
        score: leadPackage.creditCheck.creditScore,
        approved_amount: leadPackage.creditCheck.approvedAmount,
        interest_rate: leadPackage.creditCheck.interestRate,
      },
      engagement: {
        source: leadPackage.engagement.source,
        email_campaigns: leadPackage.engagement.emailCampaigns,
        chat_sessions: leadPackage.engagement.chatSessions,
        return_token_used: leadPackage.engagement.returnTokenUsed,
      },
      metadata: leadPackage.metadata,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check for the webhook endpoint
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.dealerCrmUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
