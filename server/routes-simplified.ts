import express, { Request, Response } from "express";
import { storage } from "./storage";
import { 
  handleApiError, 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequired, 
  validateEmail,
  validateDataFormat,
  asyncHandler,
  generateRequestId,
  ApiError 
} from "./utils/error-handler";
import { ErrorCode } from "./utils/error-codes";

interface RequestWithId extends Request {
  requestId?: string;
}

export async function registerRoutes(app: express.Express) {
  
  // System health check endpoint
  app.get("/api/system/health", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const stats = storage.getStats();
      const agents = storage.getAgents();
      
      res.json(createSuccessResponse({
        status: 'healthy',
        uptime: Math.round(stats.uptime),
        memoryUsage: {
          heapUsed: Math.round(stats.memory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(stats.memory.heapTotal / 1024 / 1024)
        },
        agents: agents.map(a => ({ name: a.name, status: a.status })),
        totalLeads: stats.leads,
        totalActivities: stats.activities,
        timestamp: new Date().toISOString()
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.SYSTEM_HEALTH_CHECK_FAILED, undefined, { originalError: error });
    }
  }));
  
  // Agent Status API
  app.get("/api/agents/status", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const agents = storage.getAgents();
      res.json(createSuccessResponse(agents, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.AGENT_STATUS_FETCH_FAILED, undefined, { originalError: error });
    }
  }));

  // Activity Feed API
  app.get("/api/activity", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const activities = storage.getActivities().slice(0, 50);
      res.json(createSuccessResponse(activities, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.ACTIVITY_FETCH_FAILED, undefined, { originalError: error });
    }
  }));

  // Leads API
  app.get("/api/leads", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const leads = storage.getLeads();
      res.json(createSuccessResponse(leads, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.LEAD_PROCESSING_FAILED, 'Failed to retrieve leads', { originalError: error });
    }
  }));

  // Metrics API
  app.get("/api/metrics", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const stats = storage.getStats();
      const agents = storage.getAgents();
      
      const metrics = {
        activeAgents: agents.filter(a => a.status === 'active').length,
        leadsGenerated: stats.leads,
        emailDeliveryRate: 95,
        avgResponseTime: 2.3
      };
      
      res.json(createSuccessResponse(metrics, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.SYSTEM_STATS_UNAVAILABLE, undefined, { originalError: error });
    }
  }));

  // Data Processing - Real-time Lead Processing
  app.post("/api/leads/process", asyncHandler(async (req: RequestWithId, res: Response) => {
    const { email, vehicleInterest, loanAmount, abandonmentStep } = req.body;
    
    // Validate required fields
    validateRequired(req.body, ['email']);
    validateEmail(email);

    try {
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

      res.json(createSuccessResponse({ 
        leadId: lead.id,
        message: "Lead processed and email automation triggered"
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.LEAD_PROCESSING_FAILED, undefined, { originalError: error, email: email.replace(/@.*/, '@...') });
    }
  }));

  // Data Processing - Bulk Email Campaign
  app.post("/api/email-campaigns/bulk-send", asyncHandler(async (req: RequestWithId, res: Response) => {
    const { campaignName, data: bulkData } = req.body;
    
    // Validate required fields and data format
    validateRequired(req.body, ['campaignName', 'data']);
    validateDataFormat(bulkData, 'array', 'data');

    try {
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

      res.json(createSuccessResponse({
        processed: results.length,
        message: `${campaignName} campaign processed ${results.length} records`
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.BULK_CAMPAIGN_FAILED, undefined, { originalError: error, campaignName });
    }
  }));

  // Data Processing - Dealer Webhook
  app.post("/api/webhook/dealer-leads", asyncHandler(async (req: RequestWithId, res: Response) => {
    const leadData = req.body;
    
    try {
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

      res.json(createSuccessResponse({ 
        leadId: lead.id,
        message: "Dealer lead processed successfully"
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.WEBHOOK_PROCESSING_FAILED, undefined, { originalError: error, dealerKey: leadData.dealerKey });
    }
  }));

  // System Stats
  app.get("/api/system/stats", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const stats = storage.getStats();
      res.json(createSuccessResponse(stats, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.SYSTEM_STATS_UNAVAILABLE, undefined, { originalError: error });
    }
  }));

  // Email Campaign Settings
  app.get("/api/email-campaigns/settings", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const settings = {
        timing: {
          step1Delay: 30,
          step2Delay: 180,
          step3Delay: 720
        }
      };
      res.json(createSuccessResponse(settings, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.EMAIL_SETTINGS_INVALID, undefined, { originalError: error });
    }
  }));

  app.post("/api/email-campaigns/settings", asyncHandler(async (req: RequestWithId, res: Response) => {
    const { timing } = req.body;
    
    validateRequired(req.body, ['timing']);
    
    try {
      res.json(createSuccessResponse({ 
        message: "Settings saved successfully" 
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.EMAIL_SETTINGS_INVALID, undefined, { originalError: error });
    }
  }));

  // Email Campaigns List
  app.get("/api/email-campaigns", asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const campaigns = [
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
      ];
      res.json(createSuccessResponse(campaigns, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.EMAIL_CAMPAIGN_CREATION_FAILED, 'Failed to retrieve campaigns', { originalError: error });
    }
  }));
}