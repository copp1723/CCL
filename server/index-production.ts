import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic } from "./vite";
import { handleApiError } from "./utils/error-handler";
import { storage } from "./database-storage";
import { sanitizeCampaignName, sanitizeEmail, sanitizeText, sanitizeJsonData } from "./utils/input-sanitizer";
import config from "./config/environment";
import monitoringRoutes from "./routes/monitoring";
import { 
  securityHeaders, 
  requestLogging, 
  errorHandler, 
  validateJsonPayload, 
  rateLimiter 
} from "./middleware/security";
import { requestMetricsMiddleware } from "./monitoring/metrics";

const app = express();

// Trust proxy for production deployments
if (config.get().TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Security and monitoring middleware
app.use(securityHeaders());
app.use(requestLogging());
app.use(requestMetricsMiddleware());
app.use(rateLimiter.middleware());

// Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(validateJsonPayload());

// API key authentication for internal use
const API_KEY = config.get().INTERNAL_API_KEY;

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  
  // Allow monitoring endpoints without auth for health checks
  if (req.path.startsWith('/health') || 
      req.path.startsWith('/ready') || 
      req.path.startsWith('/live') ||
      req.path === '/api/monitoring/health' ||
      req.path === '/api/monitoring/ready' ||
      req.path === '/api/monitoring/live') {
    return next();
  }
  
  if (authHeader === `Bearer ${API_KEY}` || apiKey === API_KEY) {
    return next();
  }
  
  res.status(401).json({
    success: false,
    error: {
      code: 'AUTH_001',
      message: 'Unauthorized access - API key required',
      category: 'authentication',
      retryable: false
    },
    timestamp: new Date().toISOString()
  });
};

// Monitoring routes (some endpoints available without auth)
app.use('/api/monitoring', monitoringRoutes);
app.use('/', monitoringRoutes); // For direct health check access

// Apply authentication to other API routes
app.use('/api', authenticate);

// System health endpoint (legacy compatibility)
app.get('/health', async (req, res) => {
  try {
    const stats = await storage.getStats();
    const environment = config.get().NODE_ENV;
    const production = config.validateProductionReadiness();
    
    res.json({
      success: true,
      status: "operational",
      environment,
      timestamp: new Date().toISOString(),
      system: {
        uptime: stats.uptime,
        agents: stats.agents,
        leads: stats.leads,
        activities: stats.activities,
        memory: {
          used: Math.round(stats.memory.heapUsed / 1024 / 1024),
          total: Math.round(stats.memory.heapTotal / 1024 / 1024)
        }
      },
      production: {
        ready: production.ready,
        issues: production.issues
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'System health check failed',
        category: 'monitoring',
        retryable: true
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Agent status endpoint
app.get("/api/agents/status", async (req: Request, res: Response) => {
  try {
    console.log("Agent status request received");
    const agents = await storage.getAgents();
    console.log(`Retrieved ${agents.length} agents`);
    
    res.json({
      success: true,
      data: agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    handleApiError(res, error);
  }
});

// System activity endpoint
app.get("/api/activity", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const activities = await storage.getActivities(limit);
    
    res.json({
      success: true,
      data: activities,
      meta: { limit },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    handleApiError(res, error);
  }
});

// System metrics endpoint
app.get("/api/metrics", async (req: Request, res: Response) => {
  try {
    const stats = await storage.getStats();
    
    res.json({
      success: true,
      data: {
        leads: {
          total: stats.leads,
          status: "active"
        },
        activities: {
          total: stats.activities,
          recentActivity: true
        },
        agents: {
          total: stats.agents,
          active: stats.agents
        },
        system: {
          uptime: stats.uptime,
          memory: stats.memory,
          timestamp: stats.timestamp
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    handleApiError(res, error);
  }
});

// Lead management endpoints
app.get("/api/leads", async (req: Request, res: Response) => {
  try {
    const leads = await storage.getLeads();
    res.json({
      success: true,
      data: leads,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    handleApiError(res, error);
  }
});

app.post("/api/leads/process", async (req: Request, res: Response) => {
  try {
    const { email, leadData } = req.body;
    
    if (!email || !leadData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and leadData are required',
          category: 'validation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedLeadData = sanitizeJsonData(leadData);
    
    const lead = await storage.createLead({
      email: sanitizedEmail,
      status: 'new',
      leadData: sanitizedLeadData
    });
    
    await storage.createActivity(
      "lead_created",
      `New lead created for ${sanitizedEmail}`,
      "LeadPackagingAgent",
      { leadId: lead.id, email: sanitizedEmail }
    );
    
    res.json({
      success: true,
      data: lead,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error processing lead:", error);
    handleApiError(res, error);
  }
});

// Email campaign endpoints
app.post("/api/email-campaigns/bulk-send", async (req: Request, res: Response) => {
  try {
    const { campaignName, recipients, template } = req.body;
    
    if (!campaignName || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Campaign name and recipients array are required',
          category: 'validation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    const sanitizedCampaignName = sanitizeCampaignName(campaignName);
    const sanitizedRecipients = recipients.map(sanitizeEmail);
    
    await storage.createActivity(
      "email_campaign_started",
      `Email campaign "${sanitizedCampaignName}" started for ${sanitizedRecipients.length} recipients`,
      "EmailReengagementAgent",
      { 
        campaignName: sanitizedCampaignName, 
        recipientCount: sanitizedRecipients.length,
        template: template || "default"
      }
    );
    
    res.json({
      success: true,
      data: {
        campaignName: sanitizedCampaignName,
        recipientCount: sanitizedRecipients.length,
        status: "initiated"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error starting email campaign:", error);
    handleApiError(res, error);
  }
});

// Webhook endpoint for dealer leads
app.post("/api/webhook/dealer-leads", async (req: Request, res: Response) => {
  try {
    const leadData = sanitizeJsonData(req.body);
    const email = leadData.email ? sanitizeEmail(leadData.email) : 'unknown@dealer.com';
    
    const lead = await storage.createLead({
      email,
      status: 'new',
      leadData
    });
    
    await storage.createActivity(
      "dealer_lead_received",
      `Dealer lead received via webhook`,
      "VisitorIdentifierAgent",
      { leadId: lead.id, source: "dealer_webhook" }
    );
    
    res.json({
      success: true,
      data: { leadId: lead.id },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error processing dealer webhook:", error);
    handleApiError(res, error);
  }
});

// Error handling middleware (must be last)
app.use(errorHandler());

// Initialize server
const port = config.get().PORT;

async function startServer() {
  try {
    // Validate environment configuration
    const validation = config.validateProductionReadiness();
    if (!validation.ready && config.isProductionMode()) {
      console.error("Production readiness validation failed:");
      validation.issues.forEach(issue => console.error(`  - ${issue}`));
      process.exit(1);
    }

    if (validation.issues.length > 0) {
      console.warn("Production readiness issues detected:");
      validation.issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    const server = await setupVite(app, null);
    server.listen(port, "0.0.0.0", () => {
      console.log(`CCL Agent System running on port ${port}`);
      console.log(`Environment: ${config.get().NODE_ENV}`);
      console.log(`Database persistence enabled`);
      console.log(`API Key authentication: ${config.get().INTERNAL_API_KEY}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Monitoring: http://localhost:${port}/api/monitoring/health`);
      console.log(`Production ready: ${validation.ready}`);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    function gracefulShutdown() {
      console.log('Received shutdown signal, closing server gracefully...');
      server.close(() => {
        console.log('Server closed successfully');
        process.exit(0);
      });
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

export { app };