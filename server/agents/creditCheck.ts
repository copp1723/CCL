import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import { performFlexPathCreditCheck } from '../services/external';

export class CreditCheckAgent {
  private agent: Agent;
  private creditCache: Map<string, { result: any; expires: Date }> = new Map();

  constructor() {
    const performCreditCheckTool = tool({
      name: 'perform_credit_check',
      description: 'Perform soft-pull credit check via FlexPath API',
      execute: async ({ phone, visitorId }: {
        phone: string;
        visitorId: number;
      }) => {
        return await this.executeCreditCheck(phone, visitorId);
      },
    });

    const validatePhoneTool = tool({
      name: 'validate_phone',
      description: 'Validate phone number in E.164 format',
      execute: async ({ phone }: { phone: string }) => {
        return this.validatePhoneNumber(phone);
      },
    });

    this.agent = new Agent({
      name: 'CreditCheckAgent',
      instructions: `
        You are responsible for performing credit checks and validating applicant information.
        
        Key responsibilities:
        1. Validate phone numbers in E.164 format
        2. Call FlexPath API for soft-pull credit checks
        3. Cache credit results for 5 minutes to avoid duplicate calls
        4. Emit 'approved' or 'declined' events based on results
        5. Handle credit check failures gracefully
        
        Always validate phone format before making API calls.
        Cache results to improve performance and reduce API costs.
        Provide clear feedback on credit decisions.
      `,
      tools: [performCreditCheckTool, validatePhoneTool],
    });
  }

  private validatePhoneNumber(phone: string): { valid: boolean; formatted?: string; error?: string } {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Check if it's a valid US phone number
    if (digits.length === 10) {
      return {
        valid: true,
        formatted: `+1${digits}`,
      };
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return {
        valid: true,
        formatted: `+${digits}`,
      };
    } else {
      return {
        valid: false,
        error: 'Phone number must be 10 digits (US) or 11 digits starting with 1',
      };
    }
  }

  private async executeCreditCheck(phone: string, visitorId: number) {
    // Validate phone number
    const phoneValidation = this.validatePhoneNumber(phone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error || 'Invalid phone number');
    }

    const formattedPhone = phoneValidation.formatted!;

    // Check cache first
    const cacheKey = formattedPhone;
    const cached = this.creditCache.get(cacheKey);
    if (cached && cached.expires > new Date()) {
      await storage.createActivity({
        type: 'credit_check_cached',
        description: `Used cached credit result for phone ${formattedPhone}`,
        agentId: (await storage.getAgentByType('credit_check'))?.id,
        relatedId: visitorId.toString(),
        metadata: { phone: formattedPhone, result: cached.result }
      });

      return cached.result;
    }

    try {
      // Perform credit check via FlexPath API
      const creditResult = await performFlexPathCreditCheck(formattedPhone);
      
      // Cache result for 5 minutes
      const expires = new Date(Date.now() + 5 * 60 * 1000);
      this.creditCache.set(cacheKey, { result: creditResult, expires });

      // Update visitor with credit status if they exist
      const visitor = await storage.getVisitor(visitorId);
      if (visitor) {
        // Create or update lead with credit information
        const contactInfo = {
          phone: formattedPhone,
          emailHash: visitor.emailHash,
        };

        const lead = await storage.createLead({
          visitorId,
          contactInfo,
          creditStatus: creditResult.approved ? 'approved' : 'declined',
          source: 'realtime_chat',
          status: 'credit_checked',
          dealerSubmitted: false,
        });

        await storage.createActivity({
          type: creditResult.approved ? 'credit_approved' : 'credit_declined',
          description: `Credit check ${creditResult.approved ? 'approved' : 'declined'} for visitor ${visitorId}`,
          agentId: (await storage.getAgentByType('credit_check'))?.id,
          relatedId: lead.id.toString(),
          metadata: { 
            phone: formattedPhone, 
            creditScore: creditResult.creditScore,
            approvedAmount: creditResult.approvedAmount,
            interestRate: creditResult.interestRate
          }
        });
      }

      // Update agent metrics
      const agent = await storage.getAgentByType('credit_check');
      if (agent) {
        await storage.updateAgent(agent.id, {
          eventsProcessed: (agent.eventsProcessed || 0) + 1,
          lastActivity: new Date(),
        });
      }

      return creditResult;
    } catch (error) {
      await storage.createActivity({
        type: 'credit_check_failed',
        description: `Credit check failed for visitor ${visitorId}`,
        agentId: (await storage.getAgentByType('credit_check'))?.id,
        relatedId: visitorId.toString(),
        metadata: { 
          phone: formattedPhone, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  async performCreditCheck(phone: string, visitorId: number) {
    try {
      const result = await this.executeCreditCheck(phone, visitorId);
      
      await storage.createActivity({
        type: 'credit_check_completed',
        description: `Credit check completed for visitor ${visitorId}`,
        agentId: (await storage.getAgentByType('credit_check'))?.id,
        relatedId: visitorId.toString(),
        metadata: { phone, result }
      });

      return result;
    } catch (error) {
      await storage.createActivity({
        type: 'credit_check_error',
        description: `Credit check error for visitor ${visitorId}`,
        agentId: (await storage.getAgentByType('credit_check'))?.id,
        relatedId: visitorId.toString(),
        metadata: { phone, error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }

  getAgent() {
    return this.agent;
  }
}
