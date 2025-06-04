import type { CreditCheckResult } from '../agents/CreditCheckAgent';

interface CacheEntry {
  result: CreditCheckResult;
  expiry: number;
}

export class CreditService {
  private cache: Map<string, CacheEntry> = new Map();
  private flexPathToken: string;

  constructor() {
    this.flexPathToken = process.env.FLEXPATH_TOKEN || 'mock_flexpath_token';
  }

  async performCreditCheck(phoneNumber: string): Promise<CreditCheckResult> {
    try {
      console.log(`[CreditService] Performing credit check for: ${phoneNumber}`);
      
      // In production, this would call the actual FlexPath API
      if (this.flexPathToken === 'mock_flexpath_token') {
        return await this.mockFlexPathAPI(phoneNumber);
      } else {
        return await this.callFlexPathAPI(phoneNumber);
      }
    } catch (error) {
      console.error('[CreditService] Error performing credit check:', error);
      throw new Error(`Credit check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callFlexPathAPI(phoneNumber: string): Promise<CreditCheckResult> {
    // Production FlexPath API implementation
    try {
      /*
      const response = await fetch('https://api.flexpath.com/v1/credit-check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.flexPathToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          type: 'soft_pull',
          product: 'auto_loan',
        }),
      });

      if (!response.ok) {
        throw new Error(`FlexPath API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        approved: data.approved,
        creditScore: data.credit_score,
        approvedAmount: data.approved_amount,
        interestRate: data.interest_rate,
        reasons: data.decline_reasons,
      };
      */
      
      // For now, fall back to mock
      return await this.mockFlexPathAPI(phoneNumber);
    } catch (error) {
      console.error('[CreditService] FlexPath API error:', error);
      throw error;
    }
  }

  private async mockFlexPathAPI(phoneNumber: string): Promise<CreditCheckResult> {
    // Mock FlexPath API for development
    console.log('[CreditService] Using mock FlexPath API');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate realistic mock results based on phone number
    const phoneHash = this.hashPhone(phoneNumber);
    const creditScore = 600 + (phoneHash % 200); // Score between 600-799
    const approved = creditScore >= 650; // Approve if score >= 650
    
    if (approved) {
      const baseAmount = 25000;
      const approvedAmount = baseAmount + (phoneHash % 25000); // $25k-$50k
      const baseRate = 3.9;
      const interestRate = baseRate + ((phoneHash % 500) / 100); // 3.9% - 8.9%
      
      return {
        approved: true,
        creditScore,
        approvedAmount,
        interestRate: Math.round(interestRate * 100) / 100,
      };
    } else {
      const reasons = [
        'Credit score below minimum threshold',
        'Insufficient credit history',
        'High debt-to-income ratio',
      ];
      
      return {
        approved: false,
        creditScore,
        reasons: [reasons[phoneHash % reasons.length]],
      };
    }
  }

  private hashPhone(phoneNumber: string): number {
    let hash = 0;
    for (let i = 0; i < phoneNumber.length; i++) {
      const char = phoneNumber.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  cacheResult(key: string, result: CreditCheckResult, ttlMs: number): void {
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { result, expiry });
    
    // Clean up expired entries
    this.cleanupExpiredCache();
  }

  getCachedResult(key: string): CreditCheckResult | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats for monitoring
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0.85, // Mock hit rate
    };
  }
}
