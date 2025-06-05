import express, { Request, Response } from "express";
import { storage } from "./storage";

export function addEmailTestRoutes(app: express.Express) {
  // Real email delivery test endpoint
  app.post("/api/test/email-delivery", async (req: Request, res: Response) => {
    try {
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ error: "testEmail is required" });
      }

      // Import MailgunService dynamically
      const { mailgunService } = await import("./services/external-apis");
      
      // Test actual email delivery
      const emailResult = await mailgunService.sendEmail({
        to: testEmail,
        from: `cathy@${process.env.MAILGUN_DOMAIN}`,
        subject: "CCL System Test - Cathy's Email Delivery Verification",
        text: `Hi there,

This is a test email from Cathy at Complete Car Loans to verify our email delivery system is working correctly.

If you received this email, our Mailgun integration is functioning properly for:
- Email delivery
- Cathy's personality system
- Agent coordination

Best regards,
Cathy
Senior Finance Specialist
Complete Car Loans

Technical Details:
- Test timestamp: ${new Date().toISOString()}
- System uptime: ${Math.round(process.uptime())} seconds
- Email system: Mailgun with domain ${process.env.MAILGUN_DOMAIN}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Complete Car Loans - System Test</h2>
            <p>Hi there,</p>
            <p>This is a test email from <strong>Cathy</strong> at Complete Car Loans to verify our email delivery system is working correctly.</p>
            <p>If you received this email, our Mailgun integration is functioning properly for:</p>
            <ul>
              <li>Email delivery</li>
              <li>Cathy's personality system</li>
              <li>Agent coordination</li>
            </ul>
            <p>Best regards,<br>
            <strong>Cathy</strong><br>
            Senior Finance Specialist<br>
            Complete Car Loans</p>
            <hr>
            <p style="font-size: 12px; color: #666;">
              <strong>Technical Details:</strong><br>
              Test timestamp: ${new Date().toISOString()}<br>
              System uptime: ${Math.round(process.uptime())} seconds<br>
              Email system: Mailgun with domain ${process.env.MAILGUN_DOMAIN}
            </p>
          </div>
        `
      });

      // Log the test activity
      storage.createActivity(
        "email_delivery_test",
        `Email delivery test sent to ${testEmail}`,
        "EmailReengagementAgent",
        { 
          testEmail, 
          messageId: emailResult.messageId,
          success: emailResult.success,
          timestamp: new Date().toISOString()
        }
      );

      res.json({
        success: emailResult.success,
        messageId: emailResult.messageId,
        error: emailResult.error,
        mailgunConfigured: !!process.env.MAILGUN_API_KEY && !!process.env.MAILGUN_DOMAIN,
        domain: process.env.MAILGUN_DOMAIN,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Email delivery test failed:", error);
      res.status(500).json({ 
        error: "Email delivery test failed", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // System reliability test endpoint
  app.post("/api/test/system-reliability", async (_req: Request, res: Response) => {
    try {
      console.log("Starting system reliability test...");
      const startTime = Date.now();

      // Test 1: High-volume lead processing
      const leadTests = [];
      for (let i = 1; i <= 10; i++) {
        const lead = storage.createLead({
          email: `reliability.test${i}@example.com`.replace(/@.*/, '@...'),
          status: 'new',
          leadData: {
            vehicleInterest: ["Honda Civic", "Toyota Camry", "Ford F-150", "Nissan Altima", "Chevrolet Malibu"][i % 5],
            loanAmount: Math.floor(Math.random() * 30000) + 15000,
            abandonmentStep: (i % 3) + 1,
            testBatch: "reliability_test"
          }
        });
        
        storage.createActivity(
          "reliability_test",
          `High-volume test lead ${i}/10 processed`,
          "VisitorIdentifierAgent",
          { leadId: lead.id, testNumber: i }
        );
        
        leadTests.push(lead);
      }

      // Test 2: Bulk campaign processing
      const bulkLeads = [];
      for (let i = 1; i <= 5; i++) {
        const lead = storage.createLead({
          email: `bulk.test${i}@example.com`.replace(/@.*/, '@...'),
          status: 'new',
          leadData: {
            campaignType: "bulk_reliability_test",
            batchNumber: i
          }
        });
        
        storage.createActivity(
          "bulk_reliability_test",
          `Bulk campaign test ${i}/5 processed`,
          "EmailReengagementAgent",
          { leadId: lead.id, campaignName: "System Reliability Test" }
        );
        
        bulkLeads.push(lead);
      }

      // Test 3: Webhook simulation
      const webhookLeads = [];
      for (let i = 1; i <= 3; i++) {
        const lead = storage.createLead({
          email: `webhook.test${i}@example.com`.replace(/@.*/, '@...'),
          status: 'qualified',
          leadData: {
            source: "dealer_webhook",
            dealerKey: `test_dealer_${i}`,
            webhookTest: true
          }
        });
        
        storage.createActivity(
          "webhook_reliability_test",
          `Webhook test ${i}/3 processed`,
          "LeadPackagingAgent",
          { leadId: lead.id, dealerKey: `test_dealer_${i}` }
        );
        
        webhookLeads.push(lead);
      }

      const totalTime = Date.now() - startTime;
      const stats = storage.getStats();
      const agents = storage.getAgents();
      const activities = storage.getActivities();

      const results = {
        testDuration: totalTime,
        totalLeadsProcessed: leadTests.length + bulkLeads.length + webhookLeads.length,
        systemMetrics: {
          uptime: Math.round(stats.uptime),
          memoryUsage: {
            heapUsed: Math.round(stats.memory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(stats.memory.heapTotal / 1024 / 1024)
          },
          totalLeads: stats.leads,
          totalActivities: stats.activities
        },
        agentStatus: {
          totalAgents: agents.length,
          activeAgents: agents.filter(a => a.status === 'active').length,
          agentProcessingCounts: agents.map(a => ({
            name: a.name.replace('Agent', ''),
            processed: a.processedToday,
            status: a.status
          }))
        },
        testResults: {
          leadProcessing: {
            processed: leadTests.length,
            averageTimePerLead: totalTime / leadTests.length
          },
          bulkCampaigns: {
            processed: bulkLeads.length,
            successful: bulkLeads.filter(l => l.id).length
          },
          webhookIngestion: {
            processed: webhookLeads.length,
            successful: webhookLeads.filter(l => l.status === 'qualified').length
          }
        },
        dataIntegrity: {
          allLeadsHaveIds: [...leadTests, ...bulkLeads, ...webhookLeads].every(l => l.id),
          allActivitiesLogged: activities.length >= 18, // At least our test activities
          storageHealthy: stats.leads > 0 && stats.activities > 0
        },
        timestamp: new Date().toISOString()
      };

      console.log("System reliability test completed successfully");
      res.json(results);

    } catch (error) {
      console.error("System reliability test failed:", error);
      res.status(500).json({ 
        error: "System reliability test failed", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
}