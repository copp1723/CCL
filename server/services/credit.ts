/**
 * Mock FlexPath API integration for credit checks
 * In production, this would integrate with FlexPath API
 */

export interface CreditCheckRequest {
  phone: string;
  email: string;
  firstName?: string;
  lastName?: string;
  zipCode?: string;
}

export interface CreditCheckResponse {
  success: boolean;
  creditScore?: number;
  creditTier?: 'PRIME' | 'NEAR_PRIME' | 'SUBPRIME' | 'DEEP_SUBPRIME';
  approvalStatus: 'APPROVED' | 'CONDITIONAL' | 'DECLINED';
  maxLoanAmount?: number;
  estimatedRate?: number;
  error?: string;
  requestId: string;
}

class CreditService {
  private apiToken: string;
  private cache: Map<string, { response: CreditCheckResponse; expiry: number }>;

  constructor() {
    this.apiToken = process.env.FLEXPATH_TOKEN || process.env.CREDIT_API_TOKEN || 'mock_token';
    this.cache = new Map();
  }

  /**
   * Perform soft credit pull via FlexPath API
   */
  async performCreditCheck(request: CreditCheckRequest): Promise<CreditCheckResponse> {
    try {
      // Validate phone number format (E.164)
      if (!this.isValidPhoneE164(request.phone)) {
        return {
          success: false,
          approvalStatus: 'DECLINED',
          error: 'Invalid phone number format. Please use E.164 format.',
          requestId: this.generateRequestId()
        };
      }

      // Check cache first (5 minute TTL)
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        console.log(`[CreditService] Returning cached result for ${request.phone}`);
        return cached.response;
      }

      console.log(`[CreditService] Performing credit check for ${request.phone}`);

      // Mock API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulate different credit outcomes based on phone number
      const response = this.mockCreditResponse(request);

      // Cache the response for 5 minutes
      this.cache.set(cacheKey, {
        response,
        expiry: Date.now() + (5 * 60 * 1000)
      });

      return response;
    } catch (error) {
      console.error('[CreditService] Error performing credit check:', error);
      return {
        success: false,
        approvalStatus: 'DECLINED',
        error: error instanceof Error ? error.message : 'Credit check failed',
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Mock credit response based on phone number
   */
  private mockCreditResponse(request: CreditCheckRequest): CreditCheckResponse {
    const lastDigit = parseInt(request.phone.slice(-1));
    
    // Simulate 70% approval rate
    if (lastDigit <= 7) {
      const creditScore = 600 + (lastDigit * 50) + Math.floor(Math.random() * 50);
      let creditTier: CreditCheckResponse['creditTier'];
      let maxLoanAmount: number;
      let estimatedRate: number;

      if (creditScore >= 740) {
        creditTier = 'PRIME';
        maxLoanAmount = 50000;
        estimatedRate = 3.5;
      } else if (creditScore >= 660) {
        creditTier = 'NEAR_PRIME';
        maxLoanAmount = 35000;
        estimatedRate = 6.5;
      } else if (creditScore >= 580) {
        creditTier = 'SUBPRIME';
        maxLoanAmount = 25000;
        estimatedRate = 12.5;
      } else {
        creditTier = 'DEEP_SUBPRIME';
        maxLoanAmount = 15000;
        estimatedRate = 18.5;
      }

      return {
        success: true,
        creditScore,
        creditTier,
        approvalStatus: 'APPROVED',
        maxLoanAmount,
        estimatedRate,
        requestId: this.generateRequestId()
      };
    } else if (lastDigit === 8) {
      return {
        success: true,
        creditScore: 550,
        creditTier: 'DEEP_SUBPRIME',
        approvalStatus: 'CONDITIONAL',
        maxLoanAmount: 10000,
        estimatedRate: 22.5,
        requestId: this.generateRequestId()
      };
    } else {
      return {
        success: true,
        approvalStatus: 'DECLINED',
        error: 'Credit score too low for approval',
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Validate E.164 phone format
   */
  private isValidPhoneE164(phone: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(request: CreditCheckRequest): string {
    return `credit_${request.phone}_${request.email}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

export const creditService = new CreditService();

// Clear expired cache entries every 5 minutes
setInterval(() => {
  creditService.clearExpiredCache();
}, 5 * 60 * 1000);
