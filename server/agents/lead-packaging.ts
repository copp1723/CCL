import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { dealerCRMService } from '../services/dealer-crm';
import type { CreditApprovedEvent, LeadSubmittedEvent } from '@shared/schema';
import EventEmitter from 'events';

export class LeadPackagingAgent extends EventEmitter {
  private agent: Agent;

  constructor() {
    super();
    
    this.agent = new Agent({
      name: 'LeadPackagingAgent',
      instructions: `
        You are the Lead Packaging Agent responsible for assembling qualified leads 
        and submitting them to dealer CRMs. Your role is to:
        
        1. Process 'approved' events from CreditCheckAgent
        2. Assemble complete lead packages with visitor, engagement, and credit data
        3. Submit leads to dealer CRM via webhook integration
        4. Handle webhook failures with retry logic and DLQ fallback
        5. Emit 'lead_submitted' events for successful submissions
        6. Maintain lead submission audit trail
        
        Key Guidelines:
        - Only package leads with approved or conditional credit status
        - Include all relevant customer and credit information
        - Retry failed webhook calls up to 3 times with exponential backoff
        - Use SQS DLQ for leads that fail after max retries
        - Log all submission attempts for compliance and debugging
        - Ensure data completeness before submission
      `,
    });
  }

  /**
   * Process approved credit event and package lead
   */
  async processApprovedCredit(event: CreditApprovedEvent): Promise<void> {
    try {
      console.log(`[LeadPackagingAgent] Processing approved credit for visitor ${event.visitorId}`);

      // Log agent activity
      await storage.createAgentActivity({
        agentName: 'LeadPackagingAgent',
        action: 'process_approved_credit',
        entityId: event.visitorId.toString(),
        entityType: 'visitor',
        status: 'processing',
        metadata: { creditStatus: event.creditStatus }
      });

      // Get visitor data
      const visitor = await storage.getVisitor(event.visitorId);
      if (!visitor) {
        throw new Error(`Visitor ${event.visitorId} not found`);
      }

      // Extract email from visitor data (need to reverse hash - in production would have lookup)
      const email = this.getEmailFromVisitor(visitor);
      
      // Extract phone from credit data or metadata
      const phone = this.getPhoneFromCreditData(event.creditData);

      // Create lead record
      const lead = await storage.createLead({
        visitorId: visitor.id,
        email,
        phone: phone || null,
        creditStatus: event.creditStatus,
        source: 'live_chat', // Based on credit check flow
        status: 'pending',
        leadData: {
          visitorData: {
            sessionId: visitor.sessionId,
            abandonmentStep: visitor.abandonmentStep,
            metadata: visitor.metadata
          },
          creditData: event.creditData,
          engagementData: {
            source: 'live_chat',
            timestamp: new Date().toISOString()
          }
        }
      });

      console.log(`[LeadPackagingAgent] Created lead ${lead.id} for visitor ${visitor.id}`);

      // Submit to dealer CRM
      await this.submitToDealer(lead, event.creditData);

      await storage.createAgentActivity({
        agentName: 'LeadPackagingAgent',
        action: 'process_approved_credit',
        entityId: event.visitorId.toString(),
        entityType: 'visitor',
        status: 'completed'
      });

    } catch (error) {
      console.error('[LeadPackagingAgent] Error processing approved credit:', error);
      
      await storage.createAgentActivity({
        agentName: 'LeadPackagingAgent',
        action: 'process_approved_credit',
        entityId: event.visitorId.toString(),
        entityType: 'visitor',
        status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  /**
   * Submit lead to dealer CRM with retry logic
   */
  private async submitToDealer(lead: any, creditData?: any): Promise<void> {
    try {
      console.log(`[LeadPackagingAgent] Submitting lead ${lead.id} to dealer CRM`);

      // Update lead status
      await storage.updateLead(lead.id, { status: 'processing' });

      // Submit with retry logic
      const result = await dealerCRMService.retrySubmission(lead, creditData);

      if (result.success) {
        // Update lead as submitted
        await storage.updateLead(lead.id, {
          status: 'submitted',
          dealerCrmSubmitted: true
        });

        // Emit success event
        const submittedEvent: LeadSubmittedEvent = {
          leadId: lead.id,
          dealerResponse: {
            dealerId: result.dealerId,
            leadReference: result.leadReference
          }
        };

        this.emit('lead_submitted', submittedEvent);

        await storage.createAgentActivity({
          agentName: 'LeadPackagingAgent',
          action: 'lead_submitted',
          entityId: lead.id.toString(),
          entityType: 'lead',
          status: 'completed',
          metadata: {
            dealerId: result.dealerId,
            leadReference: result.leadReference
          }
        });

        console.log(`[LeadPackagingAgent] Lead ${lead.id} submitted successfully`);
      } else {
        // Handle submission failure
        await this.handleSubmissionFailure(lead, result.error || 'Unknown error', result.shouldRetry);
      }

    } catch (error) {
      console.error(`[LeadPackagingAgent] Error submitting lead ${lead.id}:`, error);
      await this.handleSubmissionFailure(lead, error instanceof Error ? error.message : 'Unknown error', true);
    }
  }

  /**
   * Handle submission failure
   */
  private async handleSubmissionFailure(lead: any, error: string, shouldRetry: boolean = true): Promise<void> {
    try {
      if (shouldRetry) {
        // Update lead status to failed but retryable
        await storage.updateLead(lead.id, { status: 'failed' });

        // Send to DLQ (simulated - in production would use SQS DLQ)
        await this.sendToDLQ(lead, error);

        await storage.createAgentActivity({
          agentName: 'LeadPackagingAgent',
          action: 'lead_failed_to_dlq',
          entityId: lead.id.toString(),
          entityType: 'lead',
          status: 'completed',
          metadata: { error, sentToDLQ: true }
        });

        console.log(`[LeadPackagingAgent] Lead ${lead.id} failed, sent to DLQ`);
      } else {
        // Permanent failure
        await storage.updateLead(lead.id, { status: 'failed' });

        await storage.createAgentActivity({
          agentName: 'LeadPackagingAgent',
          action: 'lead_failed_permanent',
          entityId: lead.id.toString(),
          entityType: 'lead',
          status: 'failed',
          metadata: { error, permanent: true }
        });

        console.log(`[LeadPackagingAgent] Lead ${lead.id} failed permanently`);
      }
    } catch (dlqError) {
      console.error(`[LeadPackagingAgent] Error handling submission failure for lead ${lead.id}:`, dlqError);
    }
  }

  /**
   * Send failed lead to Dead Letter Queue (simulated)
   */
  private async sendToDLQ(lead: any, error: string): Promise<void> {
    try {
      // In production, this would send to actual SQS DLQ
      console.log(`[LeadPackagingAgent] Sending lead ${lead.id} to DLQ`);
      console.log(`[LeadPackagingAgent] DLQ payload:`, {
        leadId: lead.id,
        error,
        timestamp: new Date().toISOString(),
        retryCount: 3 // Max retries exceeded
      });

      // Simulate DLQ processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`[LeadPackagingAgent] Lead ${lead.id} added to DLQ for manual review`);
    } catch (error) {
      console.error(`[LeadPackagingAgent] Error sending lead ${lead.id} to DLQ:`, error);
    }
  }

  /**
   * Get email from visitor (placeholder - in production would need proper lookup)
   */
  private getEmailFromVisitor(visitor: any): string {
    // In production, this would require a secure email lookup mechanism
    // For now, generate a placeholder based on hash
    return `customer_${visitor.emailHash.substring(0, 8)}@example.com`;
  }

  /**
   * Extract phone from credit data
   */
  private getPhoneFromCreditData(creditData?: any): string | undefined {
    if (creditData && creditData.phone) {
      return creditData.phone;
    }
    // In production, might extract from other sources
    return undefined;
  }

  /**
   * Get lead submission statistics
   */
  async getSubmissionStats(): Promise<{
    total: number;
    submitted: number;
    failed: number;
    pending: number;
    successRate: number;
  }> {
    try {
      const pendingLeads = await storage.getLeadsByStatus('pending');
      const submittedLeads = await storage.getLeadsByStatus('submitted');
      const failedLeads = await storage.getLeadsByStatus('failed');

      const total = pendingLeads.length + submittedLeads.length + failedLeads.length;
      const submitted = submittedLeads.length;
      const failed = failedLeads.length;
      const pending = pendingLeads.length;
      const successRate = total > 0 ? (submitted / total) * 100 : 0;

      return {
        total,
        submitted,
        failed,
        pending,
        successRate
      };
    } catch (error) {
      console.error('[LeadPackagingAgent] Error getting submission stats:', error);
      return {
        total: 0,
        submitted: 0,
        failed: 0,
        pending: 0,
        successRate: 0
      };
    }
  }

  /**
   * Process DLQ items (manual intervention)
   */
  async processDLQItem(leadId: number): Promise<boolean> {
    try {
      console.log(`[LeadPackagingAgent] Processing DLQ item for lead ${leadId}`);

      const lead = await storage.getLead(leadId);
      if (!lead) {
        console.error(`[LeadPackagingAgent] Lead ${leadId} not found in DLQ processing`);
        return false;
      }

      // Attempt resubmission
      await this.submitToDealer(lead);
      return true;
    } catch (error) {
      console.error(`[LeadPackagingAgent] Error processing DLQ item ${leadId}:`, error);
      return false;
    }
  }
}

export const leadPackagingAgent = new LeadPackagingAgent();
