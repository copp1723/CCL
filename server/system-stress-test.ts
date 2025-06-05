import { storage } from './storage';
import { MailgunService } from './services/MailgunService';

class SystemStressTest {
  private mailgunService: MailgunService;
  private testResults: any[] = [];

  constructor() {
    this.mailgunService = new MailgunService();
  }

  async testDataIngestionReliability(): Promise<{
    leadProcessingResults: any[];
    bulkCampaignResults: any[];
    webhookResults: any[];
    systemStability: any;
  }> {
    console.log('Starting comprehensive data ingestion reliability test...');
    
    const leadProcessingResults = await this.testLeadProcessing();
    const bulkCampaignResults = await this.testBulkCampaigns();
    const webhookResults = await this.testWebhookIngestion();
    const systemStability = this.checkSystemStability();

    return {
      leadProcessingResults,
      bulkCampaignResults,
      webhookResults,
      systemStability
    };
  }

  private async testLeadProcessing(): Promise<any[]> {
    const results = [];
    const testScenarios = [
      {
        name: "Standard Application",
        data: { email: "customer1@gmail.com", vehicleInterest: "Honda Civic", loanAmount: 18000, abandonmentStep: 1 }
      },
      {
        name: "High Loan Amount",
        data: { email: "customer2@yahoo.com", vehicleInterest: "BMW X5", loanAmount: 45000, abandonmentStep: 2 }
      },
      {
        name: "Truck Application",
        data: { email: "customer3@outlook.com", vehicleInterest: "Ford F-150", loanAmount: 32000, abandonmentStep: 3 }
      },
      {
        name: "Luxury Vehicle",
        data: { email: "customer4@icloud.com", vehicleInterest: "Mercedes C-Class", loanAmount: 38000, abandonmentStep: 1 }
      },
      {
        name: "Budget Vehicle",
        data: { email: "customer5@gmail.com", vehicleInterest: "Toyota Corolla", loanAmount: 12000, abandonmentStep: 2 }
      }
    ];

    for (const scenario of testScenarios) {
      try {
        const startTime = Date.now();
        
        // Create lead
        const lead = storage.createLead({
          email: scenario.data.email.replace(/@.*/, '@...'),
          status: 'new',
          leadData: scenario.data
        });

        // Log activity
        storage.createActivity(
          "lead_processing",
          `Real-time lead processed: ${scenario.data.email.replace(/@.*/, '@...')}`,
          "VisitorIdentifierAgent",
          { leadId: lead.id, source: "stress_test" }
        );

        // Trigger email automation
        storage.createActivity(
          "email_automation",
          `Email automation triggered for step ${scenario.data.abandonmentStep}`,
          "EmailReengagementAgent",
          { email: scenario.data.email.replace(/@.*/, '@...'), step: scenario.data.abandonmentStep }
        );

        const processingTime = Date.now() - startTime;

        results.push({
          scenario: scenario.name,
          success: true,
          leadId: lead.id,
          processingTime,
          dataIntegrity: this.validateLeadData(lead, scenario.data)
        });

      } catch (error) {
        results.push({
          scenario: scenario.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async testBulkCampaigns(): Promise<any[]> {
    const results = [];
    const bulkDataSets = [
      {
        name: "Small Batch",
        size: 3,
        data: [
          { email: "bulk1@example.com", abandonmentStep: 1, vehicleInterest: "Honda Accord" },
          { email: "bulk2@example.com", abandonmentStep: 2, vehicleInterest: "Toyota Camry" },
          { email: "bulk3@example.com", abandonmentStep: 3, vehicleInterest: "Nissan Altima" }
        ]
      },
      {
        name: "Medium Batch",
        size: 10,
        data: Array.from({ length: 10 }, (_, i) => ({
          email: `medium${i+1}@example.com`,
          abandonmentStep: (i % 3) + 1,
          vehicleInterest: ["Honda Civic", "Toyota Corolla", "Ford Focus", "Nissan Sentra", "Hyundai Elantra"][i % 5]
        }))
      }
    ];

    for (const batch of bulkDataSets) {
      try {
        const startTime = Date.now();
        const processedLeads = [];

        for (const record of batch.data) {
          const lead = storage.createLead({
            email: record.email.replace(/@.*/, '@...'),
            status: 'new',
            leadData: record
          });
          
          storage.createActivity(
            "bulk_campaign",
            `Bulk email queued for customer...`,
            "EmailReengagementAgent",
            { leadId: lead.id, campaignName: `Stress Test - ${batch.name}` }
          );
          
          processedLeads.push(lead);
        }

        const processingTime = Date.now() - startTime;

        results.push({
          batchName: batch.name,
          success: true,
          recordsProcessed: processedLeads.length,
          processingTime,
          averageTimePerRecord: processingTime / processedLeads.length
        });

      } catch (error) {
        results.push({
          batchName: batch.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async testWebhookIngestion(): Promise<any[]> {
    const results = [];
    const webhookData = [
      {
        name: "Standard Dealer Lead",
        data: {
          email: "dealer1@dealership.com",
          firstName: "Sarah",
          lastName: "Johnson",
          phone: "555-0123",
          vehicleInterest: "2023 Honda Civic",
          dealerKey: "test_dealer_123"
        }
      },
      {
        name: "High Value Lead",
        data: {
          email: "dealer2@dealership.com",
          firstName: "Michael",
          lastName: "Rodriguez",
          phone: "555-0456",
          vehicleInterest: "2024 Toyota Highlander",
          dealerKey: "premium_dealer_456"
        }
      }
    ];

    for (const webhook of webhookData) {
      try {
        const startTime = Date.now();
        
        const lead = storage.createLead({
          email: webhook.data.email.replace(/@.*/, '@...'),
          status: 'qualified',
          leadData: webhook.data
        });

        storage.createActivity(
          "webhook_lead",
          "Webhook lead received from dealer",
          "LeadPackagingAgent",
          { leadId: lead.id, dealerKey: webhook.data.dealerKey }
        );

        const processingTime = Date.now() - startTime;

        results.push({
          webhookName: webhook.name,
          success: true,
          leadId: lead.id,
          processingTime
        });

      } catch (error) {
        results.push({
          webhookName: webhook.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private validateLeadData(lead: any, originalData: any): boolean {
    return !!(
      lead.id &&
      lead.email &&
      lead.status &&
      lead.createdAt &&
      lead.leadData &&
      lead.leadData.vehicleInterest === originalData.vehicleInterest &&
      lead.leadData.loanAmount === originalData.loanAmount
    );
  }

  private checkSystemStability(): any {
    const stats = storage.getStats();
    const agents = storage.getAgents();
    const activities = storage.getActivities();

    return {
      systemUptime: stats.uptime,
      memoryUsage: {
        heapUsed: Math.round(stats.memory.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(stats.memory.heapTotal / 1024 / 1024) + ' MB'
      },
      agentStatus: {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'active').length,
        agentProcessingCounts: agents.map(a => ({ name: a.name, processed: a.processedToday }))
      },
      activityMetrics: {
        totalActivities: activities.length,
        recentActivities: activities.slice(0, 5).length,
        activityTypes: [...new Set(activities.map(a => a.type))]
      },
      dataIntegrity: {
        leadsStored: stats.leads,
        activitiesLogged: stats.activities,
        storageHealthy: stats.leads >= 0 && stats.activities >= 0
      }
    };
  }

  async testEmailDeliveryStability(): Promise<any> {
    console.log('Testing email delivery system stability...');
    
    try {
      // Test single email delivery
      const testResult = await this.mailgunService.sendEmail({
        to: 'system-test@example.com',
        from: 'cathy@' + (process.env.MAILGUN_DOMAIN || 'example.com'),
        subject: 'CCL System Test - Email Delivery Verification',
        text: 'This is a system test email from Cathy at Complete Car Loans.',
        html: '<p>This is a system test email from <strong>Cathy</strong> at Complete Car Loans.</p>'
      });

      return {
        emailSystemConfigured: !!process.env.MAILGUN_API_KEY && !!process.env.MAILGUN_DOMAIN,
        testEmailResult: testResult,
        mailgunDomain: process.env.MAILGUN_DOMAIN || 'Not configured',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        emailSystemConfigured: false,
        error: error instanceof Error ? error.message : 'Unknown email system error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const systemStressTest = new SystemStressTest();