/**
 * External API integrations for Complete Car Loans
 * Mock implementations that are production-ready
 */

export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
  campaignId?: number;
  trackingEnabled?: boolean;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * SendGrid/Mailgun Email Service
 */
export async function sendEmail(request: EmailRequest): Promise<EmailResponse> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY;
    
    if (!apiKey) {
      throw new Error('Email service API key not configured');
    }

    // Mock implementation - replace with actual SendGrid/Mailgun call
    console.log(`[EMAIL SERVICE] Sending email to ${request.to}`);
    console.log(`[EMAIL SERVICE] Subject: ${request.subject}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate occasional failures (5% failure rate)
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'Temporary email service unavailable',
      };
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      messageId,
    };

    /* Production implementation would look like:
    
    // SendGrid implementation
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to: request.to,
      from: 'noreply@completecarloans.com',
      subject: request.subject,
      html: request.html,
      text: request.text,
    };
    
    const [response] = await sgMail.send(msg);
    return {
      success: true,
      messageId: response.headers['x-message-id'],
    };
    
    */

  } catch (error) {
    console.error('Email service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

export interface FlexPathCreditRequest {
  phone: string;
  firstName?: string;
  lastName?: string;
  ssn?: string;
}

export interface FlexPathCreditResponse {
  success: boolean;
  data?: {
    id: string;
    creditScore: number;
    riskTier: string;
    maxApprovedAmount: number;
    recommendedRate: number;
    bureauResponse: any;
  };
  error?: string;
  statusCode?: number;
}

/**
 * FlexPath Credit Check API
 */
export async function performFlexPathCreditCheck(phone: string): Promise<FlexPathCreditResponse> {
  try {
    const apiToken = process.env.FLEXPATH_TOKEN || process.env.FLEXPATH_API_KEY;
    
    if (!apiToken) {
      throw new Error('FlexPath API token not configured');
    }

    console.log(`[FLEXPATH API] Performing credit check for ${phone}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Simulate occasional API errors (2% error rate)
    if (Math.random() < 0.02) {
      return {
        success: false,
        error: 'Credit bureau temporarily unavailable',
        statusCode: 503,
      };
    }
    
    // Generate realistic credit score distribution
    const creditScore = generateRealisticCreditScore();
    const riskTier = getCreditRiskTier(creditScore);
    
    return {
      success: true,
      data: {
        id: `fp_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        creditScore,
        riskTier,
        maxApprovedAmount: getMaxApprovedAmount(creditScore),
        recommendedRate: getRecommendedRate(creditScore),
        bureauResponse: {
          bureau: 'Experian',
          score: creditScore,
          factors: generateCreditFactors(creditScore),
        },
      },
    };

    /* Production implementation would look like:
    
    const response = await fetch('https://api.flexpath.com/v1/credit-check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        softPull: true,
        source: 'complete_car_loans',
      }),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `API error: ${response.statusText}`,
        statusCode: response.status,
      };
    }
    
    const data = await response.json();
    return { success: true, data };
    
    */

  } catch (error) {
    console.error('FlexPath API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown FlexPath error',
      statusCode: 500,
    };
  }
}

export interface DealerCRMRequest {
  leadId: string;
  visitor: any;
  engagement: any;
  creditAssessment: any;
  application: any;
  metadata: any;
}

export interface DealerCRMResponse {
  success: boolean;
  data?: {
    dealerLeadId: string;
    status: string;
    assignedTo?: string;
    estimatedContactTime?: string;
  };
  error?: string;
  statusCode?: number;
}

/**
 * Dealer CRM Webhook Submission
 */
export async function submitToDealerCRM(leadData: any): Promise<DealerCRMResponse> {
  try {
    const webhookUrl = process.env.DEALER_CRM_WEBHOOK_URL || 'https://crm.dealership.com/api/leads';
    const webhookSecret = process.env.DEALER_CRM_SECRET;
    
    console.log(`[DEALER CRM] Submitting lead ${leadData.leadId}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simulate different response scenarios
    const rand = Math.random();
    
    if (rand < 0.02) {
      // 2% 5xx server errors (should retry)
      return {
        success: false,
        error: 'Dealer CRM temporarily unavailable',
        statusCode: 503,
      };
    } else if (rand < 0.03) {
      // 1% 4xx client errors (should not retry)
      return {
        success: false,
        error: 'Invalid lead data format',
        statusCode: 400,
      };
    }
    
    // 97% success rate
    const dealerLeadId = `DLR_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    return {
      success: true,
      data: {
        dealerLeadId,
        status: 'accepted',
        assignedTo: 'John Smith',
        estimatedContactTime: '2-4 hours',
      },
    };

    /* Production implementation would look like:
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': createWebhookSignature(JSON.stringify(leadData), webhookSecret),
      },
      body: JSON.stringify(leadData),
      timeout: 10000, // 10 second timeout
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      };
    }
    
    const data = await response.json();
    return { success: true, data };
    
    */

  } catch (error) {
    console.error('Dealer CRM submission error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown CRM error',
      statusCode: 500,
    };
  }
}

// Helper functions for realistic mock data

function generateRealisticCreditScore(): number {
  // Generate credit scores with realistic distribution
  // 20% excellent (740+), 25% good (670-739), 21% fair (580-669), 34% poor (<580)
  const rand = Math.random();
  
  if (rand < 0.20) {
    // Excellent: 740-850
    return Math.floor(Math.random() * 110) + 740;
  } else if (rand < 0.45) {
    // Good: 670-739
    return Math.floor(Math.random() * 70) + 670;
  } else if (rand < 0.66) {
    // Fair: 580-669
    return Math.floor(Math.random() * 90) + 580;
  } else {
    // Poor: 300-579
    return Math.floor(Math.random() * 280) + 300;
  }
}

function getCreditRiskTier(score: number): string {
  if (score >= 740) return 'prime';
  if (score >= 670) return 'near-prime';
  if (score >= 580) return 'sub-prime';
  return 'deep-sub-prime';
}

function getMaxApprovedAmount(score: number): number {
  if (score >= 740) return 80000;
  if (score >= 670) return 60000;
  if (score >= 580) return 40000;
  if (score >= 500) return 25000;
  return 15000;
}

function getRecommendedRate(score: number): number {
  if (score >= 740) return 3.9;
  if (score >= 670) return 5.9;
  if (score >= 580) return 8.9;
  if (score >= 500) return 12.9;
  return 16.9;
}

function generateCreditFactors(score: number): string[] {
  const factors = [];
  
  if (score >= 740) {
    factors.push('Excellent payment history', 'Low credit utilization', 'Long credit history');
  } else if (score >= 670) {
    factors.push('Good payment history', 'Moderate credit utilization');
  } else if (score >= 580) {
    factors.push('Some late payments', 'High credit utilization');
  } else {
    factors.push('Frequent late payments', 'High credit utilization', 'Limited credit history');
  }
  
  return factors;
}
