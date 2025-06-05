import { mailgunService } from './services/external-apis';
import { storage } from './storage';

class EmailDeliveryTest {
  private mailgunService = mailgunService;

  constructor() {
    // Using singleton mailgun service
  }

  async testEmailDelivery(testEmail: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log(`Testing email delivery to: ${testEmail}`);
      
      // Create a realistic Cathy email
      const emailContent = {
        to: testEmail,
        from: 'cathy@' + (process.env.MAILGUN_DOMAIN || 'example.com'),
        subject: 'Your Auto Loan Pre-Approval - Cathy from Complete Car Loans',
        text: `Hi there,

It's Cathy from Complete Car Loans. I noticed you started an auto loan application but didn't finish.

No worries - I help people with all credit situations get approved every day. Your application is saved and we can pick up right where you left off.

As a sub-prime specialist with 15+ years experience, I've seen it all. Whether your credit is perfect or needs some work, we have lenders who can help.

Would you like me to walk you through your next steps? It's much simpler than most people think.

Best regards,
Cathy
Senior Finance Specialist
Complete Car Loans

P.S. This is a soft credit check - it won't hurt your score.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Complete Car Loans</h2>
            <p>Hi there,</p>
            <p>It's <strong>Cathy</strong> from Complete Car Loans. I noticed you started an auto loan application but didn't finish.</p>
            <p>No worries - I help people with <em>all credit situations</em> get approved every day. Your application is saved and we can pick up right where you left off.</p>
            <p>As a sub-prime specialist with 15+ years experience, I've seen it all. Whether your credit is perfect or needs some work, we have lenders who can help.</p>
            <p>Would you like me to walk you through your next steps? It's much simpler than most people think.</p>
            <p>Best regards,<br>
            <strong>Cathy</strong><br>
            Senior Finance Specialist<br>
            Complete Car Loans</p>
            <p style="font-size: 12px; color: #666;">P.S. This is a soft credit check - it won't hurt your score.</p>
          </div>
        `
      };

      const result = await this.mailgunService.sendEmail(emailContent);
      
      if (result.success) {
        // Log successful email activity
        storage.createActivity(
          "email_delivery_test",
          `Test email delivered successfully to ${testEmail}`,
          "EmailReengagementAgent",
          { messageId: result.messageId, testEmail }
        );
        
        console.log(`Email delivered successfully. Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('Email delivery failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Email test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testBulkEmailReliability(): Promise<{
    totalSent: number;
    successful: number;
    failed: number;
    results: any[];
  }> {
    console.log('Starting bulk email reliability test...');
    
    const testEmails = [
      'test1@example.com',
      'test2@example.com', 
      'test3@example.com'
    ];

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const email of testEmails) {
      try {
        const result = await this.testEmailDelivery(email);
        results.push({ email, ...result });
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
        
        // Small delay between sends to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        results.push({ 
          email, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return {
      totalSent: testEmails.length,
      successful,
      failed,
      results
    };
  }
}

export const emailDeliveryTest = new EmailDeliveryTest();