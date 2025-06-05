import express, { Request, Response } from "express";
import { storage } from "./storage";
import { handleApiError, createSuccessResponse, createErrorResponse, validateRequired, validateEmail, ApiError } from "./utils/error-handler";

export async function registerRoutes(app: express.Express) {
  
  // System stress test endpoint
  app.post("/api/system/stress-test", async (_req: Request, res: Response) => {
    try {
      const { systemStressTest } = await import("./system-stress-test");
      
      console.log("Starting comprehensive system stress test...");
      const startTime = Date.now();
      
      const [
        dataIngestionResults,
        emailDeliveryResults
      ] = await Promise.all([
        systemStressTest.testDataIngestionReliability(),
        systemStressTest.testEmailDeliveryStability()
      ]);
      
      const totalTime = Date.now() - startTime;
      
      const results = {
        testDuration: totalTime,
        timestamp: new Date().toISOString(),
        dataIngestion: dataIngestionResults,
        emailDelivery: emailDeliveryResults,
        summary: {
          totalLeadsProcessed: dataIngestionResults.leadProcessingResults.length + 
                               dataIngestionResults.bulkCampaignResults.reduce((acc, batch) => acc + (batch.recordsProcessed || 0), 0) +
                               dataIngestionResults.webhookResults.length,
          systemStable: dataIngestionResults.systemStability.dataIntegrity.storageHealthy,
          emailSystemReady: emailDeliveryResults.emailSystemConfigured
        }
      };
      
      console.log("Stress test completed successfully");
      res.json(results);
    } catch (error) {
      console.error("Stress test failed:", error);
      res.status(500).json({ 
        error: "Stress test failed", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });
  
  // Agent Status API
  app.get("/api/agents/status", async (_req: Request, res: Response) => {
    try {
      const agents = storage.getAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agent status:", error);
      res.status(500).json({ message: "Failed to fetch agent status" });
    }
  });

  // Activity Feed API
  app.get("/api/activity", async (_req: Request, res: Response) => {
    try {
      const activities = storage.getActivities().slice(0, 50);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Leads API
  app.get("/api/leads", async (_req: Request, res: Response) => {
    try {
      const leads = storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Metrics API
  app.get("/api/metrics", async (_req: Request, res: Response) => {
    try {
      const stats = storage.getStats();
      const agents = storage.getAgents();
      
      const metrics = {
        activeAgents: agents.filter(a => a.status === 'active').length,
        leadsGenerated: stats.leads,
        emailDeliveryRate: 95, // Mock for demo
        avgResponseTime: 2.3
      };
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Data Processing - Real-time Lead Processing
  app.post("/api/leads/process", async (req: Request, res: Response) => {
    try {
      const { email, vehicleInterest, loanAmount, abandonmentStep } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Create new lead
      const lead = storage.createLead({
        email: email.replace(/@.*/, '@...'), // Mask email for privacy
        status: 'new',
        leadData: { vehicleInterest, loanAmount, abandonmentStep }
      });

      // Log activity
      storage.createActivity(
        "lead_processing",
        `Real-time lead processed: ${email.replace(/@.*/, '@...')}`,
        "VisitorIdentifierAgent",
        { leadId: lead.id, source: "website_form" }
      );

      // Trigger email automation
      storage.createActivity(
        "email_automation",
        `Email automation triggered for step ${abandonmentStep || 1}`,
        "EmailReengagementAgent",
        { email: email.replace(/@.*/, '@...'), step: abandonmentStep || 1 }
      );

      res.json({ 
        success: true, 
        leadId: lead.id,
        message: "Lead processed and email automation triggered"
      });
    } catch (error) {
      console.error("Error processing lead:", error);
      res.status(500).json({ error: "Failed to process lead" });
    }
  });

  // Data Processing - Bulk Email Campaign
  app.post("/api/email-campaigns/bulk-send", async (req: Request, res: Response) => {
    try {
      const { campaignName, data: bulkData } = req.body;
      
      if (!bulkData || !Array.isArray(bulkData)) {
        return res.status(400).json({ error: "Bulk data array is required" });
      }

      const results = [];
      for (const record of bulkData.slice(0, 5)) { // Process first 5 for demo
        const lead = storage.createLead({
          email: record.email?.replace(/@.*/, '@...') || 'customer@...',
          status: 'new',
          leadData: record
        });
        
        storage.createActivity(
          "email_campaign",
          `Bulk email queued for customer...`,
          "EmailReengagementAgent", 
          { leadId: lead.id, campaignName }
        );
        
        results.push(lead);
      }

      res.json({
        success: true,
        processed: results.length,
        message: `${campaignName} campaign processed ${results.length} records`
      });
    } catch (error) {
      console.error("Error processing bulk campaign:", error);
      res.status(500).json({ error: "Failed to process bulk campaign" });
    }
  });

  // Data Processing - Dealer Webhook
  app.post("/api/webhook/dealer-leads", async (req: Request, res: Response) => {
    try {
      const leadData = req.body;
      
      const lead = storage.createLead({
        email: leadData.email?.replace(/@.*/, '@...') || 'dealer-lead@...',
        status: 'qualified',
        leadData
      });

      storage.createActivity(
        "webhook_lead",
        "Webhook lead received from dealer",
        "LeadPackagingAgent",
        { leadId: lead.id, dealerKey: leadData.dealerKey || "demo_dealer_key_123" }
      );

      res.json({ 
        success: true, 
        leadId: lead.id,
        message: "Dealer lead processed successfully"
      });
    } catch (error) {
      console.error("Error processing dealer webhook:", error);
      res.status(500).json({ error: "Failed to process dealer webhook" });
    }
  });

  // System Stats
  app.get("/api/system/stats", async (_req: Request, res: Response) => {
    try {
      const stats = storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).json({ message: "Failed to fetch system stats" });
    }
  });

  // Email Campaign Settings (Mock for demo)
  app.get("/api/email-campaigns/settings", async (_req: Request, res: Response) => {
    res.json({
      timing: {
        step1Delay: 30,
        step2Delay: 180,
        step3Delay: 720
      }
    });
  });

  app.post("/api/email-campaigns/settings", async (req: Request, res: Response) => {
    try {
      // In a real system, this would save to database
      res.json({ success: true, message: "Settings saved successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // Email Campaigns List (Mock for demo)
  app.get("/api/email-campaigns", async (_req: Request, res: Response) => {
    res.json([
      {
        id: "campaign_1",
        name: "Live Demo Campaign",
        status: "active",
        totalRecipients: 3,
        emailsSent: 3,
        openRate: 67,
        clickRate: 33,
        createdAt: new Date().toISOString()
      }
    ]);
  });
}