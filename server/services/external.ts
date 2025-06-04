// Mock external API services - ready for production integration

export interface FlexPathCreditResult {
  approved: boolean;
  creditScore: number;
  approvedAmount?: number;
  interestRate?: number;
  reasons?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DealerSubmissionResult {
  success: boolean;
  dealerId?: string;
  confirmationNumber?: string;
  response?: any;
  error?: string;
}

// Mock FlexPath API integration
export async function performFlexPathCreditCheck(phone: string): Promise<FlexPathCreditResult> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Mock credit decision logic
  const creditScore = Math.floor(Math.random() * 350) + 450; // 450-800
  const approved = creditScore >= 580;

  const result: FlexPathCreditResult = {
    approved,
    creditScore,
  };

  if (approved) {
    result.approvedAmount = Math.floor(Math.random() * 50000) + 10000; // $10k-$60k
    result.interestRate = Math.random() * 15 + 3.99; // 3.99%-18.99%
  } else {
    result.reasons = [
      'Credit score below minimum threshold',
      'Insufficient credit history',
      'High debt-to-income ratio'
    ].slice(0, Math.floor(Math.random() * 3) + 1);
  }

  // Simulate occasional API failures
  if (Math.random() < 0.05) { // 5% failure rate
    throw new Error('FlexPath API temporarily unavailable');
  }

  return result;
}

// Mock Mailgun/SendGrid email service
export async function sendEmail(options: {
  to: string;
  subject: string;
  template: string;
  returnToken: string;
}): Promise<boolean> {
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  // Simulate email sending success rate (95%)
  const success = Math.random() > 0.05;

  if (!success) {
    throw new Error('Email delivery failed');
  }

  // Log email for development
  console.log(`📧 Email sent to ${options.to}`);
  console.log(`   Subject: ${options.subject}`);
  console.log(`   Return Token: ${options.returnToken}`);

  return true;
}

// Mock dealer CRM webhook submission
export async function submitToDealerCRM(leadData: any): Promise<DealerSubmissionResult> {
  // Simulate webhook delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));

  // Simulate dealer CRM response patterns
  const randomOutcome = Math.random();

  if (randomOutcome < 0.85) { // 85% success rate
    return {
      success: true,
      dealerId: `DEALER_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      confirmationNumber: `CONF_${Date.now().toString(36).toUpperCase()}`,
      response: {
        status: 'accepted',
        estimatedResponseTime: '24-48 hours',
        contactMethod: 'phone',
      },
    };
  } else if (randomOutcome < 0.95) { // 10% 4xx errors (client errors)
    return {
      success: false,
      error: 'Invalid lead data format',
    };
  } else { // 5% 5xx errors (server errors) 
    throw new Error('502: Dealer CRM temporarily unavailable');
  }
}

// Environment variable helpers
export function getAPIKey(service: string): string {
  const keys = {
    openai: process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN || 'sk-test-key',
    flexpath: process.env.FLEXPATH_API_KEY || process.env.FLEXPATH_TOKEN || 'flexpath-test-key',
    sendgrid: process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY || 'sendgrid-test-key',
    mailgun: process.env.MAILGUN_API_KEY || process.env.MAILGUN_TOKEN || 'mailgun-test-key',
  };

  return keys[service as keyof typeof keys] || 'default-test-key';
}

// SQS Mock (for abandonment events)
export async function sendToSQS(queueName: string, message: any): Promise<void> {
  console.log(`📨 SQS Message to ${queueName}:`, JSON.stringify(message, null, 2));
  
  // Simulate SQS delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
}

// SES Mock (for email notifications)
export async function sendViaSES(params: {
  to: string[];
  subject: string;
  body: string;
  from?: string;
}): Promise<{ messageId: string }> {
  console.log(`📧 SES Email to ${params.to.join(', ')}`);
  console.log(`   Subject: ${params.subject}`);
  
  // Simulate SES delay
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  
  return {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}
