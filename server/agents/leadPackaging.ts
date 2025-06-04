import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import { submitToDealerCRM } from '../services/external';
import type { Lead, Visitor } from '@shared/schema';

export class LeadPackagingAgent {
  private agent: Agent;

  constructor() {
    const packageLeadTool = tool({
      name: 'package_lead',
      description: 'Assemble lead data for dealer submission',
      execute: async ({ visitorId, creditApproved }: {
        visitorId: number;
        creditApproved: boolean;
      }) => {
        return await this.assembleLeadData(visitorId, creditApproved);
      },
    });

    const submitToDealerTool = tool({
      name: 'submit_to_dealer',
      description: 'Submit packaged lead to dealer CRM via webhook',
      execute: async ({ leadData }: { leadData: any }) => {
        return await this.submitToDealer(leadData);
      },
    });

    this.agent = new Agent({
      name: 'LeadPackagingAgent',
      instructions: `
        You are responsible for packaging qualified leads and submitting them to dealer CRMs.
        
        Key responsibilities:
        1. Assemble complete lead JSON with visitor, engagement, and credit information
        2. Submit leads to dealer CRM via webhook
        3. Handle webhook failures with retry logic
        4. Fallback to SQS DLQ on persistent 5xx errors
        5. Track submission success rates and dealer response times
        
        Only package leads that have completed credit checks.
        Ensure all required fields are present before submission.
        Handle dealer CRM failures gracefully with appropriate fallbacks.
      `,
      tools: [packageLeadTool, submitToDealerTool],
    });
  }

  private async assembleLeadData(visitorId: number, creditApproved: boolean) {
    const visitor = await storage.getVisitor(visitorId);
    if (!visitor) {
      throw new Error('Visitor not found');
    }

    // Get chat messages for engagement data
    const chatSessions = await storage.getActiveChatSessions();
    const visitorSession = chatSessions.find(s => s.visitorId === visitorId);
    let engagementData = {};

    if (visitorSession) {
      const messages = await storage.getChatMessages(visitorSession.sessionId);
      engagementData = {
        chatMessages: messages.length,
        sessionDuration: visitorSession.lastMessage.getTime() - visitorSession.createdAt.getTime(),
        lastInteraction: visitorSession.lastMessage,
      };
    }

    // Get existing lead or create new one
    let lead = (await storage.getRecentLeads(50)).find(l => l.visitorId === visitorId);
    if (!lead) {
      lead = await storage.createLead({
        visitorId,
        contactInfo: { emailHash: visitor.emailHash },
        creditStatus: creditApproved ? 'approved' : 'declined',
        source: 'chat_engagement',
        status: 'ready_for_submission',
        dealerSubmitted: false,
      });
    }

    const leadData = {
      leadId: `LD-${lead.id.toString().padStart(4, '0')}`,
      visitor: {
        id: visitor.id,
        sessionId: visitor.sessionId,
        emailHash: visitor.emailHash,
        firstSeen: visitor.createdAt,
        lastActivity: visitor.lastActivity,
        abandonmentDetected: visitor.abandonmentDetected,
      },
      engagement: engagementData,
      credit: {
        approved: creditApproved,
        status: lead.creditStatus,
        checkDate: new Date(),
      },
      source: lead.source,
      createdAt: lead.createdAt,
      metadata: visitor.metadata,
    };

    return { leadData, leadId: lead.id };
  }

  private async submitToDealer(leadData: any) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const result = await submitToDealerCRM(leadData);
        
        if (result.success) {
          await storage.createActivity({
            type: 'lead_submitted',
            description: `Lead ${leadData.leadId} submitted to dealer CRM`,
            agentId: (await storage.getAgentByType('lead_packaging'))?.id,
            relatedId: leadData.visitor.id.toString(),
            metadata: { 
              leadId: leadData.leadId, 
              dealerResponse: result.response,
              attempt: attempt + 1
            }
          });

          return result;
        } else {
          throw new Error(result.error || 'Dealer submission failed');
        }
      } catch (error) {
        attempt++;
        const isServerError = error instanceof Error && error.message.includes('5');
        
        if (attempt >= maxRetries || !isServerError) {
          // Send to DLQ for 5xx errors or after max retries
          await this.sendToDLQ(leadData, error);
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async sendToDLQ(leadData: any, error: any) {
    // In production, this would send to AWS SQS DLQ
    await storage.createActivity({
      type: 'lead_sent_to_dlq',
      description: `Lead ${leadData.leadId} sent to DLQ after submission failure`,
      agentId: (await storage.getAgentByType('lead_packaging'))?.id,
      relatedId: leadData.visitor.id.toString(),
      metadata: { 
        leadId: leadData.leadId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }

  async packageLead(visitorId: number, creditApproved: boolean) {
    try {
      const { leadData, leadId } = await this.assembleLeadData(visitorId, creditApproved);
      
      if (creditApproved) {
        const submissionResult = await this.submitToDealer(leadData);
        
        // Update lead status
        await storage.updateLead(leadId, {
          status: 'submitted',
          dealerSubmitted: true,
          submittedAt: new Date(),
        });

        // Update agent metrics
        const agent = await storage.getAgentByType('lead_packaging');
        if (agent) {
          await storage.updateAgent(agent.id, {
            eventsProcessed: (agent.eventsProcessed || 0) + 1,
            lastActivity: new Date(),
          });
        }

        return { leadData, submitted: true, result: submissionResult };
      } else {
        await storage.updateLead(leadId, {
          status: 'credit_declined',
        });

        await storage.createActivity({
          type: 'lead_not_submitted',
          description: `Lead ${leadData.leadId} not submitted due to credit decline`,
          agentId: (await storage.getAgentByType('lead_packaging'))?.id,
          relatedId: visitorId.toString(),
          metadata: { leadId: leadData.leadId, reason: 'credit_declined' }
        });

        return { leadData, submitted: false, reason: 'credit_declined' };
      }
    } catch (error) {
      await storage.createActivity({
        type: 'lead_packaging_error',
        description: `Error packaging lead for visitor ${visitorId}`,
        agentId: (await storage.getAgentByType('lead_packaging'))?.id,
        relatedId: visitorId.toString(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }

  getAgent() {
    return this.agent;
  }
}
