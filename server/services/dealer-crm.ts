/**
 * Mock dealer CRM integration service
 * In production, this would integrate with actual dealer CRM webhooks
 */

import { Lead } from '@shared/schema';

export interface DealerCRMPayload {
  leadId: number;
  customer: {
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  creditInfo: {
    status: string;
    score?: number;
    tier?: string;
    maxLoanAmount?: number;
    estimatedRate?: number;
  };
  source: string;
  leadData?: any;
  timestamp: string;
}

export interface DealerCRMResponse {
  success: boolean;
  dealerId?: string;
  leadReference?: string;
  error?: string;
  shouldRetry?: boolean;
}

class DealerCRMService {
  private webhookUrl: string;
  private apiKey: string;

  constructor() {
    this.webhookUrl = process.env.DEALER_CRM_WEBHOOK_URL || 'https://mock-dealer-crm.example.com/webhook';
    this.apiKey = process.env.DEALER_CRM_API_KEY || 'mock_dealer_api_key';
  }

  /**
   * Submit lead to dealer CRM
   */
  async submitLead(lead: Lead, creditData?: any): Promise<DealerCRMResponse> {
    try {
      const payload: DealerCRMPayload = {
        leadId: lead.id,
        customer: {
          email: lead.email,
          phone: lead.phone || undefined,
        },
        creditInfo: {
          status: lead.creditStatus || 'unknown',
          ...(creditData && {
            score: creditData.creditScore,
            tier: creditData.creditTier,
            maxLoanAmount: creditData.maxLoanAmount,
            estimatedRate: creditData.estimatedRate,
          }),
        },
        source: lead.source || 'unknown',
        leadData: lead.leadData,
        timestamp: new Date().toISOString(),
      };

      console.log(`[DealerCRMService] Submitting lead ${lead.id} to dealer CRM`);
      console.log(`[DealerCRMService] Payload:`, JSON.stringify(payload, null, 2));

      // Mock API call with retry logic
      const response = await this.makeWebhookCall(payload);
      
      if (response.success) {
        console.log(`[DealerCRMService] Lead ${lead.id} submitted successfully`);
      } else {
        console.error(`[DealerCRMService] Failed to submit lead ${lead.id}:`, response.error);
      }

      return response;
    } catch (error) {
      console.error(`[DealerCRMService] Error submitting lead ${lead.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true,
      };
    }
  }

  /**
   * Make webhook call with simulated responses
   */
  private async makeWebhookCall(payload: DealerCRMPayload): Promise<DealerCRMResponse> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate different response scenarios
    const random = Math.random();
    
    if (random < 0.85) {
      // 85% success rate
      return {
        success: true,
        dealerId: `dealer_${Math.floor(Math.random() * 1000)}`,
        leadReference: `ref_${payload.leadId}_${Date.now()}`,
      };
    } else if (random < 0.95) {
      // 10% temporary failures (should retry)
      return {
        success: false,
        error: 'Dealer CRM temporarily unavailable',
        shouldRetry: true,
      };
    } else {
      // 5% permanent failures (should not retry)
      return {
        success: false,
        error: 'Invalid lead data format',
        shouldRetry: false,
      };
    }
  }

  /**
   * Retry failed webhook calls
   */
  async retrySubmission(lead: Lead, creditData?: any, attempt: number = 1): Promise<DealerCRMResponse> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    if (attempt > maxRetries) {
      return {
        success: false,
        error: `Max retries (${maxRetries}) exceeded`,
        shouldRetry: false,
      };
    }

    console.log(`[DealerCRMService] Retry attempt ${attempt} for lead ${lead.id}`);

    // Exponential backoff
    if (attempt > 1) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const response = await this.submitLead(lead, creditData);
    
    if (!response.success && response.shouldRetry && attempt < maxRetries) {
      return this.retrySubmission(lead, creditData, attempt + 1);
    }

    return response;
  }

  /**
   * Health check for dealer CRM endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('[DealerCRMService] Performing health check');
      
      // Mock health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 95% uptime simulation
      return Math.random() > 0.05;
    } catch (error) {
      console.error('[DealerCRMService] Health check failed:', error);
      return false;
    }
  }
}

export const dealerCRMService = new DealerCRMService();
