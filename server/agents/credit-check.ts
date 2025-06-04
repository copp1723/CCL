import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { creditService } from '../services/credit';
import { isValidPhone } from '../utils/pii';
import type { CreditApprovedEvent } from '@shared/schema';
import EventEmitter from 'events';

export class CreditCheckAgent extends EventEmitter {
  private agent: Agent;

  constructor() {
    super();
    
    this.agent = new Agent({
      name: 'CreditCheckAgent',
      instructions: `
        You are the Credit Check Agent responsible for performing soft credit pulls 
        via FlexPath API and validating customer creditworthiness. Your role is to:
        
        1. Receive handoff requests from RealtimeChatAgent with phone numbers
        2. Validate phone numbers in E.164 format
        3. Call FlexPath API for soft credit pulls (no credit score impact)
        4. Cache credit results in Redis with 5-minute TTL
        5. Emit 'approved' events for qualified applicants
        6. Handle API errors and rate limiting gracefully
        
        Key Guidelines:
        - Only accept valid E.164 phone number formats
        - Cache results to avoid duplicate API calls
        - Emit 'approved' only for APPROVED or CONDITIONAL status
        - Log all credit check attempts for compliance
        - Handle FlexPath API errors with proper fallbacks
        - Maintain audit trail for all credit decisions
      `,
    });
  }

  /**
   * Process credit check handoff from RealtimeChatAgent
   */
  async processHandoff(handoffData: { sessionId: string; phone: string; visitorId?: number; email?: string }): Promise<void> {
    try {
      console.log(`[CreditCheckAgent] Processing handoff for session ${handoffData.sessionId}`);

      // Log agent activity
      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action: 'process_handoff',
        entityId: handoffData.sessionId,
        entityType: 'chat_session',
        status: 'processing',
        metadata: { phone: handoffData.phone }
      });

      // Validate phone number format
      if (!isValidPhone(handoffData.phone)) {
        throw new Error(`Invalid phone number format: ${handoffData.phone}`);
      }

      // Prepare credit check request
      const creditRequest = {
        phone: handoffData.phone,
        email: handoffData.email || `session_${handoffData.sessionId}@temp.com`
      };

      // Perform credit check via FlexPath API
      const creditResult = await creditService.performCreditCheck(creditRequest);

      // Store credit check result
      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action: 'credit_check_completed',
        entityId: handoffData.sessionId,
        entityType: 'chat_session',
        status: creditResult.success ? 'completed' : 'failed',
        metadata: {
          requestId: creditResult.requestId,
          approvalStatus: creditResult.approvalStatus,
          creditScore: creditResult.creditScore,
          creditTier: creditResult.creditTier,
          error: creditResult.error
        }
      });

      // Send results back to chat
      await this.sendCreditResultToChat(handoffData.sessionId, creditResult);

      // Emit approved event if qualified
      if (creditResult.success && ['APPROVED', 'CONDITIONAL'].includes(creditResult.approvalStatus)) {
        const approvedEvent: CreditApprovedEvent = {
          visitorId: handoffData.visitorId || 0,
          creditStatus: creditResult.approvalStatus.toLowerCase(),
          creditData: {
            score: creditResult.creditScore,
            tier: creditResult.creditTier,
            maxLoanAmount: creditResult.maxLoanAmount,
            estimatedRate: creditResult.estimatedRate,
            requestId: creditResult.requestId
          }
        };

        this.emit('approved', approvedEvent);

        await storage.createAgentActivity({
          agentName: 'CreditCheckAgent',
          action: 'emit_approved',
          entityId: handoffData.visitorId?.toString() || handoffData.sessionId,
          entityType: 'visitor',
          status: 'completed',
          metadata: { approvalStatus: creditResult.approvalStatus }
        });

        console.log(`[CreditCheckAgent] Emitted approved event for visitor ${handoffData.visitorId}`);
      }

      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action: 'process_handoff',
        entityId: handoffData.sessionId,
        entityType: 'chat_session',
        status: 'completed'
      });

    } catch (error) {
      console.error('[CreditCheckAgent] Error processing handoff:', error);
      
      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action: 'process_handoff',
        entityId: handoffData.sessionId,
        entityType: 'chat_session',
        status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      // Send error message to chat
      await this.sendErrorToChat(handoffData.sessionId, error instanceof Error ? error.message : 'Credit check failed');
    }
  }

  /**
   * Send credit check results back to chat session
   */
  private async sendCreditResultToChat(sessionId: string, result: any): Promise<void> {
    try {
      let message: string;

      if (!result.success) {
        message = `I'm sorry, but I encountered an issue with the credit check: ${result.error}. Please try again or contact our support team for assistance.`;
      } else {
        switch (result.approvalStatus) {
          case 'APPROVED':
            message = `Great news! You're pre-approved for a car loan! Here are your terms:
            
💰 Max Loan Amount: $${result.maxLoanAmount?.toLocaleString()}
📊 Credit Score: ${result.creditScore}
💳 Credit Tier: ${result.creditTier}
📈 Estimated Rate: ${result.estimatedRate}% APR

You can now shop with confidence at any of our partner dealerships. Would you like me to help you find dealers in your area?`;
            break;
            
          case 'CONDITIONAL':
            message = `You're conditionally approved for a car loan! Here are your preliminary terms:
            
💰 Max Loan Amount: $${result.maxLoanAmount?.toLocaleString()}
📊 Credit Score: ${result.creditScore}
💳 Credit Tier: ${result.creditTier}
📈 Estimated Rate: ${result.estimatedRate}% APR

Final approval will depend on additional verification. Would you like to proceed with finding a vehicle?`;
            break;
            
          case 'DECLINED':
            message = `I apologize, but we're unable to approve your application at this time. This could be due to various factors in your credit profile. 

Don't worry - we have alternative options and can connect you with specialists who work with all credit situations. Would you like me to explore other possibilities?`;
            break;
            
          default:
            message = 'Credit check completed. Let me review your results and provide next steps.';
        }
      }

      // Store the response message
      await storage.createChatMessage({
        sessionId,
        role: 'assistant',
        content: message
      });

      console.log(`[CreditCheckAgent] Sent credit result to chat session ${sessionId}`);
    } catch (error) {
      console.error('[CreditCheckAgent] Error sending credit result to chat:', error);
    }
  }

  /**
   * Send error message to chat session
   */
  private async sendErrorToChat(sessionId: string, errorMessage: string): Promise<void> {
    try {
      const message = `I apologize, but there was an issue processing your credit check: ${errorMessage}. Please try again or contact our support team for assistance.`;

      await storage.createChatMessage({
        sessionId,
        role: 'assistant',
        content: message
      });

      console.log(`[CreditCheckAgent] Sent error message to chat session ${sessionId}`);
    } catch (error) {
      console.error('[CreditCheckAgent] Error sending error message to chat:', error);
    }
  }

  /**
   * Get credit check statistics
   */
  async getCreditCheckStats(): Promise<{
    total: number;
    approved: number;
    conditional: number;
    declined: number;
    failed: number;
    approvalRate: number;
  }> {
    try {
      const activities = await storage.getAgentActivityByType('CreditCheckAgent');
      const creditChecks = activities.filter(a => a.action === 'credit_check_completed');

      const total = creditChecks.length;
      const approved = creditChecks.filter(a => a.metadata?.approvalStatus === 'APPROVED').length;
      const conditional = creditChecks.filter(a => a.metadata?.approvalStatus === 'CONDITIONAL').length;
      const declined = creditChecks.filter(a => a.metadata?.approvalStatus === 'DECLINED').length;
      const failed = creditChecks.filter(a => a.status === 'failed').length;

      const approvalRate = total > 0 ? ((approved + conditional) / total) * 100 : 0;

      return {
        total,
        approved,
        conditional,
        declined,
        failed,
        approvalRate
      };
    } catch (error) {
      console.error('[CreditCheckAgent] Error getting credit check stats:', error);
      return {
        total: 0,
        approved: 0,
        conditional: 0,
        declined: 0,
        failed: 0,
        approvalRate: 0
      };
    }
  }

  /**
   * Validate phone number for credit check
   */
  validatePhoneNumber(phone: string): { valid: boolean; formatted?: string; error?: string } {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }

    if (!isValidPhone(phone)) {
      return { valid: false, error: 'Phone number must be in E.164 format (e.g., +12345678901)' };
    }

    return { valid: true, formatted: phone };
  }
}

export const creditCheckAgent = new CreditCheckAgent();
