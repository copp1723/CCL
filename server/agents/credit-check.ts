import { storage } from '../storage';
import { flexPathService, piiProtectionService } from '../services/external-apis';

export class CreditCheckService {
  async performCreditCheck(phoneNumber: string, visitorId?: number): Promise<{ success: boolean; creditCheckId?: number; error?: string }> {
    try {
      // Validate phone number
      const phoneValidation = piiProtectionService.validatePhoneNumber(phoneNumber);
      if (!phoneValidation.valid) {
        throw new Error(phoneValidation.error || 'Invalid phone number');
      }

      const formattedPhone = phoneValidation.formatted!;

      // Perform credit check via FlexPath
      const creditResult = await flexPathService.performCreditCheck({
        phoneNumber: formattedPhone,
      });

      // Store credit check result
      const creditCheck = await storage.createCreditCheck({
        visitorId: visitorId || null,
        phone: formattedPhone,
        creditScore: creditResult.creditScore,
        approved: creditResult.approved,
        externalId: creditResult.externalId,
      });

      // Log activity
      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action: creditResult.approved ? 'credit_approved' : 'credit_declined',
        status: creditResult.success ? 'success' : 'error',
        details: `Credit score: ${creditResult.creditScore}, Risk tier: ${creditResult.riskTier}`,
        visitorId,
      });

      return { 
        success: creditResult.success, 
        creditCheckId: creditCheck.id 
      };
    } catch (error) {
      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action: 'credit_check_failed',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
        visitorId,
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const creditCheckService = new CreditCheckService();