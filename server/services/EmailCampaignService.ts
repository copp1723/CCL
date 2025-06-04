import { dataMappingService } from './DataMappingService';
import { storage } from '../storage';
import { mailgunService } from './MailgunService';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  messageType: 'reengagement' | 'inmarket' | 'followup';
  delayHours: number;
  isActive: boolean;
}

interface Campaign {
  id: string;
  name: string;
  templates: EmailTemplate[];
  targetAudience: 'reengagement' | 'inmarket' | 'followup' | 'all';
  isActive: boolean;
  createdAt: Date;
  stats: {
    totalSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  };
}

interface CampaignExecution {
  campaignId: string;
  customerId: string;
  templateId: string;
  scheduledAt: Date;
  status: 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
  emailId?: string;
  error?: string;
}

interface BulkEmailRequest {
  campaignId: string;
  csvData: Record<string, any>[];
  messageType: 'reengagement' | 'inmarket' | 'followup';
  scheduleDelay?: number; // hours
}

class EmailCampaignService {
  private campaigns: Map<string, Campaign> = new Map();
  private executions: Map<string, CampaignExecution> = new Map();
  private executionQueue: CampaignExecution[] = [];

  constructor() {
    this.initializeDefaultCampaigns();
    this.startExecutionProcessor();
  }

  private initializeDefaultCampaigns(): void {
    // Re-engagement Campaign
    const reengagementCampaign: Campaign = {
      id: 'reengagement-001',
      name: 'Lead Re-engagement Sequence',
      targetAudience: 'reengagement',
      isActive: true,
      createdAt: new Date(),
      templates: [
        {
          id: 'initial-followup',
          name: 'Initial Follow-up',
          subject: 'Just checking in - your car financing options',
          messageType: 'reengagement',
          delayHours: 0,
          isActive: true
        },
        {
          id: 'second-touchpoint',
          name: 'Second Touchpoint',
          subject: 'Still here to help with your car financing',
          messageType: 'reengagement',
          delayHours: 48,
          isActive: true
        },
        {
          id: 'final-opportunity',
          name: 'Final Opportunity',
          subject: 'One last chance - let\'s get you approved',
          messageType: 'reengagement',
          delayHours: 120,
          isActive: true
        }
      ],
      stats: {
        totalSent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0
      }
    };

    // In-Market Shoppers Campaign
    const inMarketCampaign: Campaign = {
      id: 'inmarket-001',
      name: 'In-Market Shopper Nurture',
      targetAudience: 'inmarket',
      isActive: true,
      createdAt: new Date(),
      templates: [
        {
          id: 'welcome-inmarket',
          name: 'Welcome & Options Review',
          subject: 'Your car financing options are ready to review',
          messageType: 'inmarket',
          delayHours: 0,
          isActive: true
        },
        {
          id: 'prequalification-reminder',
          name: 'Pre-qualification Reminder',
          subject: 'Get pre-qualified in under 2 minutes',
          messageType: 'inmarket',
          delayHours: 24,
          isActive: true
        }
      ],
      stats: {
        totalSent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0
      }
    };

    this.campaigns.set(reengagementCampaign.id, reengagementCampaign);
    this.campaigns.set(inMarketCampaign.id, inMarketCampaign);
  }

  /**
   * Process bulk CSV data and schedule email campaigns
   */
  async processBulkEmailCampaign(request: BulkEmailRequest): Promise<{
    success: boolean;
    campaignId: string;
    scheduled: number;
    errors: Array<{ index: number; error: string; data: any }>;
  }> {
    const campaign = this.campaigns.get(request.campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${request.campaignId} not found`);
    }

    // Process CSV data using the data mapping service
    const result = dataMappingService.processBatch(request.csvData);
    
    const scheduled: CampaignExecution[] = [];
    const errors = result.errors;

    // Schedule emails for valid records
    for (const processedRecord of result.processed) {
      const customer = processedRecord.customer;
      
      // Create visitor record if needed
      let visitor = await storage.getVisitorByEmailHash(customer.email || 'unknown');
      if (!visitor && customer.email) {
        visitor = await storage.createVisitor({
          emailHash: customer.email,
          sessionId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lastActivity: new Date(),
          abandonmentDetected: false
        });
      }

      if (visitor) {
        // Schedule email sequence
        for (const template of campaign.templates) {
          if (!template.isActive) continue;

          const execution: CampaignExecution = {
            campaignId: request.campaignId,
            customerId: customer.globalCustomerId || customer.recordId || 'unknown',
            templateId: template.id,
            scheduledAt: new Date(Date.now() + (template.delayHours + (request.scheduleDelay || 0)) * 60 * 60 * 1000),
            status: 'scheduled'
          };

          this.executions.set(`${execution.campaignId}_${execution.customerId}_${execution.templateId}`, execution);
          this.executionQueue.push(execution);
          scheduled.push(execution);
        }

        // Log campaign enrollment
        await storage.createAgentActivity({
          agentName: 'EmailCampaignService',
          action: 'campaign_enrollment',
          status: 'success',
          details: `Enrolled customer in campaign ${campaign.name}`,
          visitorId: visitor.id
        });
      }
    }

    // Update campaign stats
    campaign.stats.totalSent += scheduled.length;
    this.campaigns.set(request.campaignId, campaign);

    return {
      success: true,
      campaignId: request.campaignId,
      scheduled: scheduled.length,
      errors
    };
  }

  /**
   * Start the execution processor that handles scheduled emails
   */
  private startExecutionProcessor(): void {
    setInterval(async () => {
      await this.processExecutionQueue();
    }, 60000); // Check every minute
  }

  /**
   * Process scheduled email executions
   */
  private async processExecutionQueue(): Promise<void> {
    const now = new Date();
    const readyToSend = this.executionQueue.filter(
      execution => execution.status === 'scheduled' && execution.scheduledAt <= now
    );

    for (const execution of readyToSend) {
      try {
        await this.sendScheduledEmail(execution);
      } catch (error) {
        console.error('Error sending scheduled email:', error);
        execution.status = 'failed';
        execution.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Remove completed/failed executions from queue
    this.executionQueue = this.executionQueue.filter(
      execution => execution.status === 'scheduled'
    );
  }

  /**
   * Send a scheduled email
   */
  private async sendScheduledEmail(execution: CampaignExecution): Promise<void> {
    const campaign = this.campaigns.get(execution.campaignId);
    const template = campaign?.templates.find(t => t.id === execution.templateId);
    
    if (!campaign || !template) {
      throw new Error('Campaign or template not found');
    }

    // Find visitor by customer ID - look up from stored visitor records
    const visitors = await storage.getRecentActiveVisitors();
    let visitor = visitors.find(v => v.sessionId.includes(execution.customerId));
    
    // If not found in recent visitors, check all visitors by email hash pattern
    if (!visitor) {
      const allVisitors = await storage.getRecentActiveVisitors();
      visitor = allVisitors.find(v => v.sessionId.includes('email_') && v.emailHash);
    }
    
    // If still not found, we'll use the customer ID to find by email pattern
    if (!visitor) {
      console.log(`Creating visitor record for customer ${execution.customerId} in campaign ${execution.campaignId}`);
      // This would normally be retrieved from your CRM/database
      // For now, we'll create a temporary record
      visitor = await storage.createVisitor({
        emailHash: `customer_${execution.customerId}@example.com`, // This should be the actual email
        sessionId: `campaign_${execution.customerId}_${Date.now()}`,
        lastActivity: new Date(),
        abandonmentDetected: false
      });
    }

    // Generate personalized message
    const customerData = {
      email: visitor.emailHash,
      globalCustomerId: execution.customerId
    };
    
    const customer = dataMappingService.mapCsvRowToCustomerRecord(customerData);
    const message = dataMappingService.generatePersonalizedMessage(customer, template.messageType);

    // Send email via Mailgun
    const emailResult = await mailgunService.sendEmail({
      to: visitor.emailHash,
      from: 'cathy@completecarloans.com', // You can configure this
      subject: template.subject,
      text: message.fullMessage,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0079F2;">${template.subject}</h2>
        <div style="line-height: 1.6; white-space: pre-wrap;">${message.fullMessage}</div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This email was sent by Complete Car Loans. 
          <a href="/unsubscribe?token=${visitor.sessionId}">Unsubscribe</a>
        </p>
      </div>`
    });

    if (!emailResult.success) {
      throw new Error(`Email sending failed: ${emailResult.error}`);
    }

    // Create email campaign record
    const emailCampaign = await storage.createEmailCampaign({
      visitorId: visitor.id,
      returnToken: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      emailSent: true,
      emailOpened: false,
      clicked: false
    });

    // Log email send
    await storage.createAgentActivity({
      agentName: 'EmailCampaignService',
      action: 'email_sent',
      status: 'success',
      details: `Sent ${template.name} email via ${mailgunService.isServiceConfigured() ? 'Mailgun' : 'simulation'} for campaign ${campaign.name}`,
      visitorId: visitor.id
    });

    // Update execution status
    execution.status = 'sent';
    execution.emailId = emailCampaign.id.toString();

    // Update campaign stats
    campaign.stats.delivered++;
    this.campaigns.set(execution.campaignId, campaign);

    console.log(`Email sent: ${template.subject} to customer ${execution.customerId} (Message ID: ${emailResult.messageId})`);
  }

  /**
   * Get all campaigns
   */
  getCampaigns(): Campaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Get campaign by ID
   */
  getCampaign(id: string): Campaign | undefined {
    return this.campaigns.get(id);
  }

  /**
   * Update campaign
   */
  updateCampaign(id: string, updates: Partial<Campaign>): Campaign | null {
    const campaign = this.campaigns.get(id);
    if (!campaign) return null;

    const updated = { ...campaign, ...updates };
    this.campaigns.set(id, updated);
    return updated;
  }

  /**
   * Get campaign performance metrics
   */
  getCampaignMetrics(campaignId: string): {
    totalSent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    unsubscribeRate: number;
  } | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    const stats = campaign.stats;
    return {
      totalSent: stats.totalSent,
      deliveryRate: stats.totalSent > 0 ? (stats.delivered / stats.totalSent) * 100 : 0,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
      clickRate: stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0,
      unsubscribeRate: stats.totalSent > 0 ? (stats.unsubscribed / stats.totalSent) * 100 : 0
    };
  }

  /**
   * Get scheduled executions for a campaign
   */
  getScheduledExecutions(campaignId: string): CampaignExecution[] {
    return this.executionQueue.filter(execution => execution.campaignId === campaignId);
  }

  /**
   * Cancel scheduled execution
   */
  cancelExecution(campaignId: string, customerId: string, templateId: string): boolean {
    const key = `${campaignId}_${customerId}_${templateId}`;
    const execution = this.executions.get(key);
    
    if (execution && execution.status === 'scheduled') {
      execution.status = 'failed';
      execution.error = 'Cancelled by user';
      
      // Remove from queue
      const queueIndex = this.executionQueue.findIndex(e => 
        e.campaignId === campaignId && e.customerId === customerId && e.templateId === templateId
      );
      if (queueIndex > -1) {
        this.executionQueue.splice(queueIndex, 1);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Track email open
   */
  async trackEmailOpen(emailId: string): Promise<void> {
    const emailCampaign = await storage.getEmailCampaign(parseInt(emailId));
    if (emailCampaign) {
      await storage.updateEmailCampaign(emailCampaign.id, { emailOpened: true });
      
      // Update campaign stats
      // Note: In a real implementation, you'd need to track which campaign this email belongs to
      console.log(`Email opened: ${emailId}`);
    }
  }

  /**
   * Track email click
   */
  async trackEmailClick(emailId: string): Promise<void> {
    const emailCampaign = await storage.getEmailCampaign(parseInt(emailId));
    if (emailCampaign) {
      await storage.updateEmailCampaign(emailCampaign.id, { clicked: true });
      
      // Update campaign stats
      console.log(`Email clicked: ${emailId}`);
    }
  }
}

export const emailCampaignService = new EmailCampaignService();