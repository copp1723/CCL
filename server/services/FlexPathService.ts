interface FlexPathParams {
  dealerKey: string;
  flow: 'GPQ' | 'SI';
  iidStub?: string;
  phone?: string;
  entry?: string;
  from?: string;
  launch?: string;
  [key: string]: string | undefined;
}

interface FlexPathLinkResult {
  success: boolean;
  link?: string;
  error?: string;
}

class FlexPathService {
  private baseUrl: string;
  private defaultDealerKey: string;

  constructor() {
    // Use environment variable or default to production
    const environment = process.env.FLEXPATH_ENV || 'production';
    this.baseUrl = environment === 'production' 
      ? 'https://app.flexpathdxp.com/'
      : 'https://app.latest.flexpathdxp.com/';
    
    // Default dealer key from environment or placeholder
    this.defaultDealerKey = process.env.FLEXPATH_DEALER_KEY || 'CCL_DEMO_KEY';
  }

  /**
   * Generate FlexPath pre-qualification link
   */
  generateLink(params: Partial<FlexPathParams>): FlexPathLinkResult {
    try {
      // Validate required parameters
      const dealerKey = params.dealerKey || this.defaultDealerKey;
      const flow = params.flow || 'GPQ';

      if (!dealerKey) {
        return {
          success: false,
          error: 'dealerKey is required'
        };
      }

      // If Single Vehicle flow, require iidStub
      if (flow === 'SI' && !params.iidStub) {
        return {
          success: false,
          error: 'iidStub is required for Single Vehicle (SI) flow'
        };
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      
      // Add required parameters
      queryParams.append('dealerKey', dealerKey);
      queryParams.append('flow', flow);

      // Add optional parameters if provided
      if (params.iidStub) {
        queryParams.append('iidStub', params.iidStub);
      }
      
      if (params.phone) {
        // Format phone number if needed (remove any formatting, keep numbers only)
        const cleanPhone = params.phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) {
          const formattedPhone = `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
          queryParams.append('phone', formattedPhone);
        }
      }

      if (params.entry) {
        queryParams.append('entry', params.entry);
      }

      if (params.from) {
        queryParams.append('from', params.from);
      }

      if (params.launch) {
        queryParams.append('launch', params.launch);
      }

      // Add any additional parameters
      Object.keys(params).forEach(key => {
        if (!['dealerKey', 'flow', 'iidStub', 'phone', 'entry', 'from', 'launch'].includes(key) && params[key]) {
          queryParams.append(key, params[key]!);
        }
      });

      const fullLink = `${this.baseUrl}?${queryParams.toString()}`;

      return {
        success: true,
        link: fullLink
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate FlexPath link: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate chat-specific FlexPath link
   */
  generateChatLink(phone?: string, vehicleInfo?: string): FlexPathLinkResult {
    return this.generateLink({
      flow: vehicleInfo ? 'SI' : 'GPQ',
      iidStub: vehicleInfo,
      phone,
      entry: 'CH',
      from: 'chat'
    });
  }

  /**
   * Generate email-specific FlexPath link
   */
  generateEmailLink(phone?: string, vehicleInfo?: string): FlexPathLinkResult {
    return this.generateLink({
      flow: vehicleInfo ? 'SI' : 'GPQ',
      iidStub: vehicleInfo,
      phone,
      entry: 'EM',
      from: 'email'
    });
  }

  /**
   * Generate homepage FlexPath link
   */
  generateHomepageLink(phone?: string): FlexPathLinkResult {
    return this.generateLink({
      flow: 'GPQ',
      phone,
      entry: 'HP',
      from: 'homepage'
    });
  }

  /**
   * Get appropriate response message for FlexPath handoff
   */
  getHandoffMessage(linkResult: FlexPathLinkResult, isInventorySpecific: boolean = false): string {
    if (!linkResult.success || !linkResult.link) {
      return "I'd love to get you pre-qualified right away! Let me connect you with our secure pre-qualification system. I'll have that ready for you in just a moment.";
    }

    const baseMessage = isInventorySpecific 
      ? "Perfect! I can get you pre-qualified for financing on this specific vehicle. This secure process won't affect your credit score and you'll see your personalized payment options instantly:"
      : "You're almost there! Click the secure link below to get pre-qualified for financing. This won't affect your credit score, and you'll see your best options instantly:";

    return `${baseMessage}\n\n${linkResult.link}\n\nThis secure pre-qualification takes just 2-3 minutes and uses only a soft credit pull, so there's no impact to your credit score. You'll get personalized financing options right away!`;
  }

  /**
   * Validate FlexPath environment and configuration
   */
  validateConfiguration(): { valid: boolean; message: string } {
    if (!this.defaultDealerKey || this.defaultDealerKey === 'CCL_DEMO_KEY') {
      return {
        valid: false,
        message: 'FlexPath dealer key not configured. Please set FLEXPATH_DEALER_KEY environment variable.'
      };
    }

    return {
      valid: true,
      message: 'FlexPath configuration is valid'
    };
  }
}

export const flexPathService = new FlexPathService();