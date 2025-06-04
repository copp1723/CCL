import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { submitToDealerCRM } from '../services/external-apis';

export const leadPackagingAgent = new Agent({
  name: 'LeadPackagingAgent',
  instructions: `
    You are responsible for assembling qualified leads and submitting them to dealer CRMs.
    
    Key responsibilities:
    1. Gather all visitor data, engagement history, and credit information
    2. Package lead data in standardized JSON format
    3. Submit to dealer CRM via webhook
    4. Handle submission failures with retry logic
    5. Fallback to SQS DLQ on persistent 5xx errors
    
    Lead Package Structure:
    - Visitor information (contact details, session data)
    - Engagement history (email opens, clicks, chat interactions)
    - Credit assessment (score, approval status, terms)
    - Application context (abandonment point, interests)
    - Timestamp and lead scoring
    
    Submission Process:
    1. Validate lead completeness
    2. Format according to dealer CRM schema
    3. POST to webhook endpoint
    4. Handle response codes appropriately
    5. Retry failed submissions up to 3 times
    6. Queue failed leads for manual review
    
    Success Criteria:
    - Lead submitted within 2 minutes of approval
    - 95%+ successful delivery rate
    - Complete lead data integrity
  `,
});

export interface LeadPackage {
  leadId: string;
  visitor: {
    sessionId: string;
    emailHash: string;
    lastActivity: Date;
    source: string;
  };
  engagement: {
    emailSent: boolean;
    emailOpened: boolean;
    chatSessions: number;
    returnedViaToken: boolean;
  };
  creditAssessment: {
    score: number;
    approved: boolean;
    riskTier: string;
    maxLoanAmount: number;
    estimatedRate: number;
  };
  application: {
    abandonmentStep: number;
    interests: string[];
    preferredContactMethod: string;
  };
  metadata: {
    createdAt: Date;
    leadScore: number;
    priority: 'high' | 'medium' | 'low';
  };
}

export class LeadPackagingService {
  async processApprovedLead(visitorId: number, creditCheckId: number): Promise<void> {
    try {
      // Gather all data needed for lead package
      const visitor = await storage.getVisitor(visitorId);
      const creditCheck = await storage.getCreditCheck(creditCheckId);
      const emailCampaigns = await storage.getEmailCampaignsByVisitor(visitorId);
      const chatSessions = await storage.getChatSessionsByVisitor(visitorId);

      if (!visitor || !creditCheck) {
        throw new Error(`Missing required data: visitor=${!!visitor}, creditCheck=${!!creditCheck}`);
      }

      // Assemble lead package
      const leadPackage = await this.assembleLeadPackage(visitor, creditCheck, emailCampaigns, chatSessions);

      // Create lead record
      const lead = await storage.createLead({
        visitorId: visitor.id,
        creditCheckId: creditCheck.id,
        leadData: leadPackage,
        status: 'pending',
      });

      // Submit to dealer CRM
      const submissionResult = await this.submitLeadToCRM(lead.id, leadPackage);

      if (submissionResult.success) {
        await storage.updateLead(lead.id, {
          status: 'submitted',
          dealerResponse: submissionResult.response,
          submittedAt: new Date(),
        });

        await this.logActivity('lead_submitted', 
          `Lead ${lead.id} successfully submitted to dealer CRM`, 
          visitorId, lead.id);
      } else {
        await this.handleSubmissionFailure(lead.id, submissionResult.error, visitorId);
      }

    } catch (error) {
      console.error('Error processing approved lead:', error);
      await this.logActivity('lead_processing_error', 
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        visitorId);
    }
  }

  private async assembleLeadPackage(
    visitor: any, 
    creditCheck: any, 
    emailCampaigns: any[], 
    chatSessions: any[]
  ): Promise<LeadPackage> {
    
    // Calculate engagement metrics
    const emailSent = emailCampaigns.some(c => c.emailSent);
    const emailOpened = emailCampaigns.some(c => c.emailOpened);
    const returnedViaToken = emailCampaigns.some(c => c.clicked);
    
    // Calculate lead score based on engagement and credit
    const leadScore = this.calculateLeadScore(visitor, creditCheck, emailCampaigns, chatSessions);
    
    // Determine priority
    const priority = leadScore >= 80 ? 'high' : leadScore >= 60 ? 'medium' : 'low';

    return {
      leadId: `CCL-${Date.now()}-${visitor.id}`,
      visitor: {
        sessionId: visitor.sessionId,
        emailHash: visitor.emailHash,
        lastActivity: visitor.lastActivity,
        source: visitor.abandonmentDetected ? 'abandonment_recovery' : 'direct_inquiry',
      },
      engagement: {
        emailSent,
        emailOpened,
        chatSessions: chatSessions.length,
        returnedViaToken,
      },
      creditAssessment: {
        score: creditCheck.creditScore,
        approved: creditCheck.approved,
        riskTier: this.getRiskTier(creditCheck.creditScore),
        maxLoanAmount: this.getMaxLoanAmount(creditCheck.creditScore),
        estimatedRate: this.getEstimatedRate(creditCheck.creditScore),
      },
      application: {
        abandonmentStep: 3, // Simplified - in real app, track actual step
        interests: ['auto-loan', 'competitive-rates'],
        preferredContactMethod: 'email',
      },
      metadata: {
        createdAt: new Date(),
        leadScore,
        priority,
      },
    };
  }

  private calculateLeadScore(visitor: any, creditCheck: any, emailCampaigns: any[], chatSessions: any[]): number {
    let score = 0;

    // Credit score component (40 points max)
    if (creditCheck.creditScore >= 740) score += 40;
    else if (creditCheck.creditScore >= 660) score += 30;
    else if (creditCheck.creditScore >= 580) score += 20;
    else if (creditCheck.creditScore >= 500) score += 10;

    // Engagement component (30 points max)
    if (emailCampaigns.some(c => c.emailOpened)) score += 10;
    if (emailCampaigns.some(c => c.clicked)) score += 15;
    if (chatSessions.length > 0) score += 5;

    // Recency component (20 points max)
    const hoursSinceActivity = (Date.now() - visitor.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity < 1) score += 20;
    else if (hoursSinceActivity < 24) score += 15;
    else if (hoursSinceActivity < 72) score += 10;
    else score += 5;

    // Application completeness (10 points max)
    if (visitor.abandonmentDetected) score += 10; // They got far enough to abandon

    return Math.min(score, 100);
  }

  private getRiskTier(creditScore: number): string {
    if (creditScore >= 740) return 'prime';
    if (creditScore >= 660) return 'near-prime';
    if (creditScore >= 580) return 'sub-prime';
    return 'deep-sub-prime';
  }

  private getMaxLoanAmount(creditScore: number): number {
    if (creditScore >= 740) return 80000;
    if (creditScore >= 660) return 60000;
    if (creditScore >= 580) return 40000;
    if (creditScore >= 500) return 25000;
    return 15000;
  }

  private getEstimatedRate(creditScore: number): number {
    if (creditScore >= 740) return 3.9;
    if (creditScore >= 660) return 5.9;
    if (creditScore >= 580) return 8.9;
    if (creditScore >= 500) return 12.9;
    return 16.9;
  }

  private async submitLeadToCRM(leadId: number, leadPackage: LeadPackage): Promise<{ success: boolean; response?: any; error?: string }> {
    const maxRetries = 3;
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await submitToDealerCRM(leadPackage);
        
        if (result.success) {
          await this.logActivity('lead_submission_success', 
            `Lead ${leadId} submitted successfully on attempt ${attempt}`, 
            undefined, leadId);
          return { success: true, response: result.data };
        } else {
          lastError = result.error || 'Unknown error';
          
          // Don't retry on 4xx errors (client errors)
          if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
            break;
          }
          
          if (attempt < maxRetries) {
            await this.delay(attempt * 1000); // Exponential backoff
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        if (attempt < maxRetries) {
          await this.delay(attempt * 1000);
        }
      }
    }

    return { success: false, error: lastError };
  }

  private async handleSubmissionFailure(leadId: number, error: string, visitorId: number): Promise<void> {
    try {
      // Update lead status
      await storage.updateLead(leadId, {
        status: 'failed',
        dealerResponse: { error, failedAt: new Date() },
      });

      // Log failure
      await this.logActivity('lead_submission_failed', 
        `Lead ${leadId} submission failed: ${error}`, 
        visitorId, leadId);

      // In a real system, this would send to SQS DLQ
      console.log(`Lead ${leadId} queued for manual review due to submission failure`);

      // Send to dead letter queue (simulated)
      await this.sendToDeadLetterQueue(leadId, error);

    } catch (err) {
      console.error('Error handling submission failure:', err);
    }
  }

  private async sendToDeadLetterQueue(leadId: number, error: string): Promise<void> {
    // In a real implementation, this would send to AWS SQS DLQ
    console.log(`DLQ: Lead ${leadId} failed submission - ${error}`);
    
    // Log to activity for observability
    await this.logActivity('lead_sent_to_dlq', 
      `Lead ${leadId} sent to dead letter queue: ${error}`, 
      undefined, leadId);
  }

  private async logActivity(action: string, details: string, visitorId?: number, leadId?: number): Promise<void> {
    try {
      await storage.createAgentActivity({
        agentName: 'LeadPackagingAgent',
        action,
        details,
        visitorId: visitorId || null,
        leadId: leadId || null,
        status: action.includes('error') || action.includes('failed') ? 'error' : 'success',
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getLeadById(leadId: number): Promise<any> {
    return await storage.getLead(leadId);
  }

  async getLeadsByStatus(status: string): Promise<any[]> {
    return await storage.getLeadsByStatus(status);
  }

  async retryFailedLead(leadId: number): Promise<void> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead || lead.status !== 'failed') {
        throw new Error(`Lead ${leadId} not found or not in failed status`);
      }

      const submissionResult = await this.submitLeadToCRM(leadId, lead.leadData);

      if (submissionResult.success) {
        await storage.updateLead(leadId, {
          status: 'submitted',
          dealerResponse: submissionResult.response,
          submittedAt: new Date(),
        });

        await this.logActivity('lead_retry_success', 
          `Lead ${leadId} successfully resubmitted`, 
          lead.visitorId, leadId);
      } else {
        await this.logActivity('lead_retry_failed', 
          `Lead ${leadId} retry failed: ${submissionResult.error}`, 
          lead.visitorId, leadId);
      }

    } catch (error) {
      console.error('Error retrying failed lead:', error);
    }
  }
}

export const leadPackagingService = new LeadPackagingService();
