import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { performFlexPathCreditCheck } from '../services/external-apis';
import { validatePhoneNumber } from '../services/token';

export const creditCheckAgent = new Agent({
  name: 'CreditCheckAgent',
  instructions: `
    You are responsible for performing soft-pull credit checks using the FlexPath API.
    
    Key responsibilities:
    1. Validate phone numbers in E.164 format
    2. Call FlexPath API for soft credit pulls
    3. Cache results in Redis for 5 minutes
    4. Emit 'approved' events for qualified borrowers
    5. Handle API errors and fallbacks gracefully
    
    Credit Check Process:
    1. Receive handoff from RealtimeChatAgent with phone number
    2. Validate phone number format (E.164)
    3. Check cache for recent results
    4. Call FlexPath API if not cached
    5. Store results with 5-minute TTL
    6. Return approval status and credit information
    
    Approval Criteria:
    - Credit score >= 580 for prime rates
    - Credit score 500-579 for sub-prime rates
    - Credit score < 500 requires manual review
    
    Error Handling:
    - API timeouts: retry up to 3 times
    - Invalid phone: request correction
    - Credit bureau errors: provide alternative options
  `,
});

export interface CreditCheckResult {
  approved: boolean;
  creditScore?: number;
  riskTier: 'prime' | 'near-prime' | 'sub-prime' | 'deep-sub-prime';
  maxLoanAmount?: number;
  estimatedRate?: number;
  externalId?: string;
}

export class CreditCheckService {
  private cache = new Map<string, { result: CreditCheckResult; expires: Date }>();

  async performCreditCheck(phoneNumber: string, visitorId?: number): Promise<CreditCheckResult> {
    try {
      // Validate phone number
      const validatedPhone = validatePhoneNumber(phoneNumber);
      if (!validatedPhone.valid) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      // Check cache first
      const cacheKey = `credit_check_${validatedPhone.e164}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && cached.expires > new Date()) {
        await this.logActivity('cache_hit', `Credit check cache hit for ${validatedPhone.e164}`, visitorId);
        return cached.result;
      }

      // Call FlexPath API
      const flexPathResult = await performFlexPathCreditCheck(validatedPhone.e164);
      
      if (!flexPathResult.success) {
        throw new Error(`FlexPath API error: ${flexPathResult.error}`);
      }

      // Process results
      const result = this.processCreditCheckResults(flexPathResult.data);

      // Store in database
      const creditCheck = await storage.createCreditCheck({
        visitorId: visitorId || null,
        phone: validatedPhone.e164,
        creditScore: result.creditScore,
        approved: result.approved,
        externalId: result.externalId,
      });

      // Cache results for 5 minutes
      this.cache.set(cacheKey, {
        result,
        expires: new Date(Date.now() + 5 * 60 * 1000),
      });

      // Log success
      await this.logActivity('credit_check_completed', 
        `Credit check completed: score=${result.creditScore}, approved=${result.approved}`, 
        visitorId);

      // Emit approved event if qualified
      if (result.approved) {
        await this.emitApprovedEvent(creditCheck.id, visitorId);
      }

      return result;

    } catch (error) {
      console.error('Credit check error:', error);
      
      await this.logActivity('credit_check_error', 
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        visitorId);

      // Return fallback result
      return {
        approved: false,
        riskTier: 'deep-sub-prime',
      };
    }
  }

  private processCreditCheckResults(data: any): CreditCheckResult {
    const creditScore = data.creditScore || 0;
    
    let riskTier: CreditCheckResult['riskTier'];
    let approved = false;
    let estimatedRate: number | undefined;
    let maxLoanAmount: number | undefined;

    if (creditScore >= 740) {
      riskTier = 'prime';
      approved = true;
      estimatedRate = 3.9;
      maxLoanAmount = 80000;
    } else if (creditScore >= 660) {
      riskTier = 'near-prime';
      approved = true;
      estimatedRate = 5.9;
      maxLoanAmount = 60000;
    } else if (creditScore >= 580) {
      riskTier = 'sub-prime';
      approved = true;
      estimatedRate = 8.9;
      maxLoanAmount = 40000;
    } else if (creditScore >= 500) {
      riskTier = 'sub-prime';
      approved = true;
      estimatedRate = 12.9;
      maxLoanAmount = 25000;
    } else {
      riskTier = 'deep-sub-prime';
      approved = false;
    }

    return {
      approved,
      creditScore,
      riskTier,
      maxLoanAmount,
      estimatedRate,
      externalId: data.id,
    };
  }

  private async emitApprovedEvent(creditCheckId: number, visitorId?: number): Promise<void> {
    // In a real system, this would publish to SQS/EventBridge
    console.log(`Approved event emitted for credit check ${creditCheckId}`);
    
    await this.logActivity('approved_event_emitted', 
      `Approved event emitted for credit check ${creditCheckId}`, 
      visitorId);

    // Trigger lead packaging if we have a visitor
    if (visitorId) {
      const { leadPackagingService } = await import('./lead-packaging');
      await leadPackagingService.processApprovedLead(visitorId, creditCheckId);
    }
  }

  private async logActivity(action: string, details: string, visitorId?: number): Promise<void> {
    try {
      await storage.createAgentActivity({
        agentName: 'CreditCheckAgent',
        action,
        details,
        visitorId: visitorId || null,
        status: action.includes('error') ? 'error' : 'success',
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  async getCreditCheckById(id: number): Promise<any> {
    return await storage.getCreditCheck(id);
  }

  async getCreditCheckByVisitor(visitorId: number): Promise<any> {
    return await storage.getCreditCheckByVisitorId(visitorId);
  }

  // Clean up expired cache entries
  private cleanupCache(): void {
    const now = new Date();
    for (const [key, value] of this.cache.entries()) {
      if (value.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  // Start cache cleanup interval
  startCacheCleanup(): void {
    setInterval(() => this.cleanupCache(), 60000); // Clean every minute
  }
}

export const creditCheckService = new CreditCheckService();
