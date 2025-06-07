import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import { CreditService } from '../services/CreditService';
import type { InsertAgentActivity } from '@shared/schema';

export interface CreditCheckResult {
  approved: boolean;
  creditScore?: number;
  approvedAmount?: number;
  interestRate?: number;
  reasons?: string[];
}

export class CreditCheckAgent {
  private agent: Agent;
  private creditService: CreditService;

  constructor() {
    this.creditService = new CreditService();
    
    this.agent = new Agent({
      name: 'Credit Check Agent',
      instructions: `
        You are responsible for performing credit checks on loan applicants.
        Your primary tasks:
        1. Validate phone numbers in E.164 format
        2. Call FlexPath API for soft credit pulls
        3. Cache results in memory for 5 minutes
        4. Emit 'approved' events for successful checks
        5. Handle errors gracefully and provide clear feedback
        
        Always validate phone numbers before making API calls.
        Use cached results when available to avoid duplicate checks.
        Provide clear feedback on approval status and next steps.
      `,
      tools: [
        this.createValidatePhoneTool(),
        this.createPerformCreditCheckTool(),
        this.createEmitApprovedEventTool(),
      ],
    });
  }

  private createValidatePhoneTool() {
    return tool({
      name: 'validate_phone',
      description: 'Validate phone number is in E.164 format',
      execute: async (params: { phoneNumber: string }) => {
        try {
          const { phoneNumber } = params;
          
          const isValid = this.validateE164(phoneNumber);
          
          return {
            success: true,
            isValid,
            formattedPhone: isValid ? phoneNumber : this.formatToE164(phoneNumber),
            message: isValid ? 'Phone number is valid' : 'Phone number formatted to E.164',
          };
        } catch (error) {
          console.error('[CreditCheckAgent] Error validating phone:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }

  private createPerformCreditCheckTool() {
    return tool({
      name: 'perform_credit_check',
      description: 'Perform soft credit check via FlexPath API with caching',
      execute: async (params: { phoneNumber: string; visitorId?: number }) => {
        try {
          const { phoneNumber, visitorId } = params;
          
          // Validate phone format
          const formattedPhone = this.formatToE164(phoneNumber);
          if (!this.validateE164(formattedPhone)) {
            throw new Error('Invalid phone number format');
          }

          // Check cache first
          const cacheKey = `credit_check_${formattedPhone}`;
          const cachedResult = this.creditService.getCachedResult(cacheKey);
          
          if (cachedResult) {
            console.log(`[CreditCheckAgent] Using cached result for: ${formattedPhone}`);
            return {
              success: true,
              cached: true,
              result: cachedResult,
              message: 'Credit check completed (cached)',
            };
          }

          // Perform credit check
          const result = await this.creditService.performCreditCheck(formattedPhone);
          
          // Cache result for 5 minutes
          this.creditService.cacheResult(cacheKey, result, 5 * 60 * 1000);

          // Update visitor with credit check status
          if (visitorId) {
            await storage.updateVisitor(visitorId, {
              creditCheckStatus: result.approved ? 'approved' : 'declined',
              phoneNumber: formattedPhone,
            });
          }

          console.log(`[CreditCheckAgent] Credit check completed for: ${formattedPhone}, approved: ${result.approved}`);
          
          return {
            success: true,
            cached: false,
            result,
            message: 'Credit check completed successfully',
          };
        } catch (error) {
          console.error('[CreditCheckAgent] Error performing credit check:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }

  private createEmitApprovedEventTool() {
    return tool({
      name: 'emit_approved_event',
      description: 'Emit approved event for successful credit checks',
      execute: async (params: { visitorId: number; creditResult: CreditCheckResult }) => {
        try {
          const { visitorId, creditResult } = params;
          
          if (!creditResult.approved) {
            // Log declined event
            await storage.createAgentActivity({
              agentType: 'credit_check',
              action: 'credit_declined',
              description: `Credit check declined: ${creditResult.reasons?.join(', ') || 'Unknown reason'}`,
              targetId: visitorId.toString(),
              metadata: { 
                creditScore: creditResult.creditScore,
                reasons: creditResult.reasons,
              },
            });

            return {
              success: true,
              approved: false,
              message: 'Credit check declined event logged',
            };
          }

          // Log approved event
          await storage.createAgentActivity({
            agentType: 'credit_check',
            action: 'approved',
            description: `Credit check approved - Score: ${creditResult.creditScore}, Amount: $${creditResult.approvedAmount}, Rate: ${creditResult.interestRate}%`,
            targetId: visitorId.toString(),
            metadata: { 
              creditScore: creditResult.creditScore,
              approvedAmount: creditResult.approvedAmount,
              interestRate: creditResult.interestRate,
            },
          });

          console.log(`[CreditCheckAgent] Emitted approved event for visitor: ${visitorId}`);
          
          return {
            success: true,
            approved: true,
            message: 'Credit approved event emitted successfully',
          };
        } catch (error) {
          console.error('[CreditCheckAgent] Error emitting approved event:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }

  private validateE164(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  private formatToE164(phoneNumber: string): string {
    // Remove all non-digits
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle US numbers
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // Return as-is if we can't format (may be international)
    return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`;
  }

  async performCreditCheck(phoneNumber: string, visitorId?: number): Promise<{
    success: boolean;
    result?: CreditCheckResult;
    cached?: boolean;
    error?: string;
  }> {
    try {
      // Validate and format phone number
      const formattedPhone = this.formatToE164(phoneNumber);
      if (!this.validateE164(formattedPhone)) {
        throw new Error('Invalid phone number format');
      }

      // Check cache first
      const cacheKey = `credit_check_${formattedPhone}`;
      const cachedResult = this.creditService.getCachedResult(cacheKey);
      
      if (cachedResult) {
        console.log(`[CreditCheckAgent] Using cached credit result for: ${formattedPhone}`);
        return {
          success: true,
          result: cachedResult,
          cached: true,
        };
      }

      // Perform fresh credit check
      const result = await this.creditService.performCreditCheck(formattedPhone);
      
      // Cache result for 5 minutes
      this.creditService.cacheResult(cacheKey, result, 5 * 60 * 1000);

      // Update visitor if provided
      if (visitorId) {
        await storage.updateVisitor(visitorId, {
          creditCheckStatus: result.approved ? 'approved' : 'declined',
          phoneNumber: formattedPhone,
        });

        // Log activity
        await storage.createAgentActivity({
          agentType: 'credit_check',
          action: result.approved ? 'approved' : 'credit_declined',
          description: result.approved 
            ? `Credit approved - Score: ${result.creditScore}, Amount: $${result.approvedAmount}`
            : `Credit declined: ${result.reasons?.join(', ') || 'Unknown reason'}`,
          targetId: visitorId.toString(),
          metadata: result,
        });
      }

      console.log(`[CreditCheckAgent] Credit check completed for: ${formattedPhone}, approved: ${result.approved}`);
      
      return {
        success: true,
        result,
        cached: false,
      };
    } catch (error) {
      console.error('[CreditCheckAgent] Error performing credit check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
