
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
import { authMiddleware, requireRole, requirePermission, loginHandler } from "./middleware/auth";

interface RequestWithId extends Request {
  requestId?: string;
  user?: any;
}

export async function registerSecuredRoutes(app: express.Express) {
  
  // Public authentication endpoint
  app.post("/api/auth/login", asyncHandler(async (req: RequestWithId, res: Response) => {
    await loginHandler(req, res);
  }));

  // Apply authentication middleware to all API routes except auth
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/")) {
      return next();
    }
    return authMiddleware(req, res, next);
  });

  // System health check - requires viewer role
  app.get("/api/system/health", requirePermission('read:system'), asyncHandler(async (req: RequestWithId, res: Response) => {
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
        timestamp: new Date().toISOString(),
        user: req.user?.email,
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.SYSTEM_HEALTH_CHECK_FAILED, undefined, { originalError: error });
    }
  }));
  
  // Agent Status API - requires read permission
  app.get("/api/agents/status", requirePermission('read:agents'), asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const agents = storage.getAgents();
      res.json(createSuccessResponse(agents, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.AGENT_STATUS_FETCH_FAILED, undefined, { originalError: error });
    }
  }));

  // Activity Feed API - requires read permission
  app.get("/api/activity", requirePermission('read:activity'), asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const activities = storage.getActivities().slice(0, 50);
      res.json(createSuccessResponse(activities, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.ACTIVITY_FETCH_FAILED, undefined, { originalError: error });
    }
  }));

  // Leads API - requires read permission
  app.get("/api/leads", requirePermission('read:leads'), asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const leads = storage.getLeads();
      res.json(createSuccessResponse(leads, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.LEAD_PROCESSING_FAILED, 'Failed to retrieve leads', { originalError: error });
    }
  }));

  // Data Processing - requires write permission
  app.post("/api/leads/process", requirePermission('write:leads'), asyncHandler(async (req: RequestWithId, res: Response) => {
    const { email, vehicleInterest, loanAmount, abandonmentStep } = req.body;
    
    validateRequired(req.body, ['email']);
    validateEmail(email);

    try {
      const lead = storage.createLead({
        email: email.replace(/@.*/, '@...'),
        status: 'new',
        leadData: { vehicleInterest, loanAmount, abandonmentStep }
      });

      storage.createActivity(
        "lead_processing",
        `Real-time lead processed by ${req.user?.email}`,
        "VisitorIdentifierAgent",
        { leadId: lead.id, source: "website_form", processedBy: req.user?.id }
      );

      res.json(createSuccessResponse({ 
        leadId: lead.id,
        message: "Lead processed and email automation triggered"
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.LEAD_PROCESSING_FAILED, undefined, { originalError: error, email: email.replace(/@.*/, '@...') });
    }
  }));

  // Bulk Email Campaign - requires admin or operator role
  app.post("/api/email-campaigns/bulk-send", requireRole(['admin', 'operator']), asyncHandler(async (req: RequestWithId, res: Response) => {
    const { campaignName, data: bulkData } = req.body;
    
    validateRequired(req.body, ['campaignName', 'data']);
    validateDataFormat(bulkData, 'array', 'data');

    try {
      const results = [];
      for (const record of bulkData.slice(0, 5)) {
        const lead = storage.createLead({
          email: record.email?.replace(/@.*/, '@...') || 'customer@...',
          status: 'new',
          leadData: record
        });
        
        storage.createActivity(
          "email_campaign",
          `Bulk email queued by ${req.user?.email}`,
          "EmailReengagementAgent", 
          { leadId: lead.id, campaignName, initiatedBy: req.user?.id }
        );
        
        results.push(lead);
      }

      res.json(createSuccessResponse({
        processed: results.length,
        message: `${campaignName} campaign processed ${results.length} records`,
        initiatedBy: req.user?.email,
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.BULK_CAMPAIGN_FAILED, undefined, { originalError: error, campaignName });
    }
  }));

  // System configuration - admin only
  app.get("/api/system/config", requireRole(['admin']), asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const config = {
        environment: process.env.NODE_ENV,
        version: '1.0.0',
        features: {
          authentication: true,
          rateLimit: true,
          auditLogging: true,
          securityHeaders: true,
        },
        lastUpdated: new Date().toISOString(),
      };
      
      res.json(createSuccessResponse(config, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.SYSTEM_STATS_UNAVAILABLE, undefined, { originalError: error });
    }
  }));

  // User profile endpoint
  app.get("/api/auth/profile", authMiddleware, asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      res.json(createSuccessResponse({
        user: {
          id: req.user?.id,
          email: req.user?.email,
          role: req.user?.role,
          permissions: req.user?.permissions,
        },
        lastActivity: new Date().toISOString(),
      }, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.USER_PROFILE_FETCH_FAILED, undefined, { originalError: error });
    }
  }));

  // Metrics API - requires read permission
  app.get("/api/metrics", requirePermission('read:metrics'), asyncHandler(async (req: RequestWithId, res: Response) => {
    try {
      const stats = storage.getStats();
      const agents = storage.getAgents();
      
      const metrics = {
        activeAgents: agents.filter(a => a.status === 'active').length,
        leadsGenerated: stats.leads,
        emailDeliveryRate: 95,
        avgResponseTime: 2.3,
        accessedBy: req.user?.email,
        accessTime: new Date().toISOString(),
      };
      
      res.json(createSuccessResponse(metrics, req.requestId));
    } catch (error) {
      throw new ApiError(ErrorCode.SYSTEM_STATS_UNAVAILABLE, undefined, { originalError: error });
    }
  }));
}
