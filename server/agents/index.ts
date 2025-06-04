/**
 * Agent orchestration and event handling
 */

import { visitorIdentifierAgent } from './visitor-identifier';
import { emailReengagementAgent } from './email-reengagement';
import { realtimeChatAgent } from './realtime-chat';
import { creditCheckAgent } from './credit-check';
import { leadPackagingAgent } from './lead-packaging';
import { storage } from '../storage';

/**
 * Initialize all agents and wire up event handlers
 */
export function initializeAgents(): void {
  console.log('[AgentOrchestrator] Initializing agents...');

  // VisitorIdentifierAgent -> EmailReengagementAgent
  visitorIdentifierAgent.on('lead_ready', async (event) => {
    try {
      await emailReengagementAgent.processLeadReady(event);
    } catch (error) {
      console.error('[AgentOrchestrator] Error in lead_ready handler:', error);
    }
  });

  // RealtimeChatAgent -> CreditCheckAgent
  realtimeChatAgent.on('handoff_credit_check', async (handoffData) => {
    try {
      await creditCheckAgent.processHandoff(handoffData);
    } catch (error) {
      console.error('[AgentOrchestrator] Error in handoff_credit_check handler:', error);
    }
  });

  // CreditCheckAgent -> LeadPackagingAgent
  creditCheckAgent.on('approved', async (event) => {
    try {
      await leadPackagingAgent.processApprovedCredit(event);
    } catch (error) {
      console.error('[AgentOrchestrator] Error in approved handler:', error);
    }
  });

  // Log successful events
  emailReengagementAgent.on('email_sent', async (event) => {
    try {
      await storage.createAgentActivity({
        agentName: 'AgentOrchestrator',
        action: 'email_sent_event',
        entityId: event.campaignId.toString(),
        entityType: 'email_campaign',
        status: 'completed',
        metadata: { visitorId: event.visitorId, returnToken: event.returnToken }
      });
    } catch (error) {
      console.error('[AgentOrchestrator] Error logging email_sent event:', error);
    }
  });

  leadPackagingAgent.on('lead_submitted', async (event) => {
    try {
      await storage.createAgentActivity({
        agentName: 'AgentOrchestrator',
        action: 'lead_submitted_event',
        entityId: event.leadId.toString(),
        entityType: 'lead',
        status: 'completed',
        metadata: { dealerResponse: event.dealerResponse }
      });
    } catch (error) {
      console.error('[AgentOrchestrator] Error logging lead_submitted event:', error);
    }
  });

  console.log('[AgentOrchestrator] All agents initialized and connected');
}

/**
 * Get agent status summary
 */
export async function getAgentStatus(): Promise<{
  visitorIdentifier: { status: string; abandonedVisitors: number };
  emailReengagement: { status: string; deliveryRate: number };
  realtimeChat: { status: string; activeSessions: number };
  creditCheck: { status: string; approvalRate: number };
  leadPackaging: { status: string; successRate: number };
}> {
  try {
    const [
      abandonedVisitors,
      emailMetrics,
      activeSessions,
      creditStats,
      submissionStats
    ] = await Promise.all([
      storage.getAbandonedVisitors(),
      emailReengagementAgent.getDeliveryMetrics(),
      realtimeChatAgent.getActiveSessionsCount(),
      creditCheckAgent.getCreditCheckStats(),
      leadPackagingAgent.getSubmissionStats()
    ]);

    return {
      visitorIdentifier: {
        status: 'active',
        abandonedVisitors: abandonedVisitors.length
      },
      emailReengagement: {
        status: 'active',
        deliveryRate: emailMetrics.deliveryRate
      },
      realtimeChat: {
        status: 'active',
        activeSessions
      },
      creditCheck: {
        status: 'active',
        approvalRate: creditStats.approvalRate
      },
      leadPackaging: {
        status: 'active',
        successRate: submissionStats.successRate
      }
    };
  } catch (error) {
    console.error('[AgentOrchestrator] Error getting agent status:', error);
    
    // Return default status on error
    return {
      visitorIdentifier: { status: 'error', abandonedVisitors: 0 },
      emailReengagement: { status: 'error', deliveryRate: 0 },
      realtimeChat: { status: 'error', activeSessions: 0 },
      creditCheck: { status: 'error', approvalRate: 0 },
      leadPackaging: { status: 'error', successRate: 0 }
    };
  }
}

/**
 * Simulate abandonment event (for testing)
 */
export async function simulateAbandonmentEvent(emailHash: string, step: number = 2): Promise<void> {
  try {
    const visitor = await storage.createVisitor({
      emailHash,
      sessionId: `sim_${Date.now()}`,
      abandonmentStep: step,
      isAbandoned: false,
      lastActivity: new Date(),
      metadata: { simulation: true }
    });

    const abandonmentEvent = {
      visitorId: visitor.id,
      sessionId: visitor.sessionId!,
      abandonmentStep: step,
      emailHash,
      metadata: { simulation: true }
    };

    await visitorIdentifierAgent.processAbandonmentEvent(abandonmentEvent);
    console.log(`[AgentOrchestrator] Simulated abandonment event for visitor ${visitor.id}`);
  } catch (error) {
    console.error('[AgentOrchestrator] Error simulating abandonment event:', error);
  }
}

export {
  visitorIdentifierAgent,
  emailReengagementAgent,
  realtimeChatAgent,
  creditCheckAgent,
  leadPackagingAgent
};
