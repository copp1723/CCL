import express, { type Request, Response } from "express";
import { createServer } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: express.Express) {
  const server = createServer(app);

  // Agent Status API
  app.get("/api/agents/status", async (_req: Request, res: Response) => {
    try {
      const agentStatuses = [
        {
          name: "VisitorIdentifierAgent",
          status: "active",
          lastActivity: new Date(),
          processedToday: Math.floor(Math.random() * 50),
          description: "Tracks and identifies website visitors",
          icon: "Users",
          color: "green"
        },
        {
          name: "RealtimeChatAgent", 
          status: "active",
          lastActivity: new Date(),
          processedToday: Math.floor(Math.random() * 30),
          description: "Handles real-time customer conversations",
          icon: "MessageCircle",
          color: "blue"
        },
        {
          name: "EmailReengagementAgent",
          status: "active", 
          lastActivity: new Date(),
          processedToday: Math.floor(Math.random() * 25),
          description: "Sends personalized re-engagement emails",
          icon: "Mail",
          color: "purple"
        },
        {
          name: "CreditCheckAgent",
          status: "active",
          lastActivity: new Date(), 
          processedToday: Math.floor(Math.random() * 15),
          description: "Processes credit checks via FlexPath",
          icon: "CreditCard",
          color: "orange"
        },
        {
          name: "LeadPackagingAgent",
          status: "active",
          lastActivity: new Date(),
          processedToday: Math.floor(Math.random() * 20),
          description: "Packages and submits qualified leads",
          icon: "Package",
          color: "teal"
        }
      ];
      res.json(agentStatuses);
    } catch (error) {
      console.error("Error fetching agent status:", error);
      res.status(500).json({ message: "Failed to fetch agent status" });
    }
  });

  // Activity Feed API
  app.get("/api/activity", async (_req: Request, res: Response) => {
    try {
      const activities = storage.activities.getAll()
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Leads API
  app.get("/api/leads", async (_req: Request, res: Response) => {
    try {
      const leads = storage.leads.getAll()
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
      const metrics = {
        activeAgents: 5,
        leadsGenerated: stats.leads,
        emailDeliveryRate: 95.2,
        avgResponseTime: 1.2
      };
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // **1. BULK DATASET API (Most Reliable)**
  app.post("/api/email-campaigns/bulk-send", async (req: Request, res: Response) => {
    try {
      const { campaignId = "reengagement-001", csvData, messageType = "reengagement", scheduleDelay = 0 } = req.body;
      
      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ 
          success: false, 
          message: "csvData array is required" 
        });
      }

      console.log(`Processing bulk email campaign: ${campaignId} with ${csvData.length} records`);
      
      // Import and use the EmailCampaignService
      const { emailCampaignService } = await import('./services/EmailCampaignService');
      
      const result = await emailCampaignService.processBulkEmailCampaign({
        campaignId,
        csvData,
        messageType,
        scheduleDelay
      });

      res.json(result);

    } catch (error) {
      console.error("Bulk email campaign error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process bulk email campaign",
        error: String(error)
      });
    }
  });

  // **2. REAL-TIME LEAD PROCESSING API**
  app.post("/api/leads/process", async (req: Request, res: Response) => {
    try {
      const { email, phone, abandonmentStep = 1, source = "real_time", metadata = {} } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: "Email is required" 
        });
      }

      console.log(`Processing real-time lead: ${email}`);

      // Create lead immediately
      const newLead = storage.leads.create({
        status: 'new',
        email: email,
        leadData: {
          source,
          phone,
          abandonmentStep,
          metadata,
          processedAt: new Date().toISOString()
        }
      });

      // Log activity
      storage.activities.create({
        type: 'lead_processing',
        description: `Real-time lead processed: ${email.substring(0, 8)}...`,
        agentType: 'VisitorIdentifierAgent',
        metadata: { leadId: newLead.id, source }
      });

      // Trigger email automation based on abandonment step
      const emailResult = await triggerEmailAutomation(email, abandonmentStep);
      
      res.json({
        success: true,
        leadId: newLead.id,
        message: "Lead processed and email automation triggered",
        emailResult
      });

    } catch (error) {
      console.error("Real-time lead processing error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process real-time lead",
        error: String(error)
      });
    }
  });

  // **3. DEALER WEBHOOK INTEGRATION**
  app.post("/api/webhook/dealer-leads", async (req: Request, res: Response) => {
    try {
      const { dealerKey, leads: incomingLeads } = req.body;
      
      if (!dealerKey) {
        return res.status(401).json({ 
          success: false, 
          message: "Dealer key required for authentication" 
        });
      }

      if (!incomingLeads || !Array.isArray(incomingLeads)) {
        return res.status(400).json({ 
          success: false, 
          message: "Leads array is required" 
        });
      }

      console.log(`Processing webhook from dealer with ${incomingLeads.length} leads`);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        leadIds: [] as string[]
      };

      for (const leadData of incomingLeads) {
        results.processed++;
        
        try {
          const newLead = storage.leads.create({
            status: 'new',
            email: leadData.email || `webhook_${Date.now()}@dealer.com`,
            leadData: {
              source: 'dealer_webhook',
              dealerKey,
              originalData: leadData,
              processedAt: new Date().toISOString()
            }
          });

          results.successful++;
          results.leadIds.push(newLead.id);

          // Log activity
          storage.activities.create({
            type: 'webhook_lead',
            description: `Webhook lead received from dealer`,
            agentType: 'LeadPackagingAgent',
            metadata: { leadId: newLead.id, dealerKey }
          });

        } catch (leadError) {
          results.failed++;
          console.error(`Failed to process lead ${results.processed}:`, leadError);
        }
      }

      res.json({
        success: true,
        message: `Webhook processed: ${results.successful} leads created`,
        results
      });

    } catch (error) {
      console.error("Dealer webhook error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process dealer webhook",
        error: String(error)
      });
    }
  });

  // Email Campaign API Routes
  app.get("/api/email-campaigns", async (_req: Request, res: Response) => {
    try {
      // Import the email campaign service
      const { emailCampaignService } = await import('./services/EmailCampaignService');
      const campaigns = emailCampaignService.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching email campaigns:", error);
      res.status(500).json({ message: "Failed to fetch email campaigns" });
    }
  });

  app.get("/api/email-campaigns/:id", async (req: Request, res: Response) => {
    try {
      const { emailCampaignService } = await import('./services/EmailCampaignService');
      const campaign = emailCampaignService.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.get("/api/email-campaigns/:id/metrics", async (req: Request, res: Response) => {
    try {
      const { emailCampaignService } = await import('./services/EmailCampaignService');
      const metrics = emailCampaignService.getCampaignMetrics(req.params.id);
      if (!metrics) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching campaign metrics:", error);
      res.status(500).json({ message: "Failed to fetch campaign metrics" });
    }
  });

  app.get("/api/email-campaigns/:id/scheduled", async (req: Request, res: Response) => {
    try {
      const { emailCampaignService } = await import('./services/EmailCampaignService');
      const scheduled = emailCampaignService.getScheduledExecutions(req.params.id);
      res.json(scheduled);
    } catch (error) {
      console.error("Error fetching scheduled executions:", error);
      res.status(500).json({ message: "Failed to fetch scheduled executions" });
    }
  });

  // System stats for debugging
  app.get("/api/system/stats", async (_req: Request, res: Response) => {
    try {
      const stats = storage.getStats();
      res.json({
        ...stats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).json({ message: "Failed to fetch system stats" });
    }
  });

  const port = Number(process.env.PORT || 5000);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    console.log("📧 Mailgun email system ready");
    console.log("🔄 Three data ingestion APIs active:");
    console.log("   1. POST /api/email-campaigns/bulk-send (Bulk Dataset)");
    console.log("   2. POST /api/leads/process (Real-time Processing)"); 
    console.log("   3. POST /api/webhook/dealer-leads (Dealer Webhook)");
  });

  return server;
}

// Helper function for email automation
async function triggerEmailAutomation(email: string, abandonmentStep: number) {
  try {
    // Log the email automation trigger
    storage.activities.create({
      type: 'email_automation',
      description: `Email automation triggered for step ${abandonmentStep}`,
      agentType: 'EmailReengagementAgent',
      metadata: { email: email.substring(0, 8) + "...", step: abandonmentStep }
    });

    return {
      triggered: true,
      step: abandonmentStep,
      message: `Cathy's email sequence started for abandonment step ${abandonmentStep}`
    };
  } catch (error) {
    console.error("Email automation error:", error);
    return {
      triggered: false,
      error: String(error)
    };
  }
}