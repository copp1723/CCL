
import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic } from "./vite";
import { handleApiError } from "./utils/error-handler";
import { storage } from "./database-storage";
import { sanitizeCampaignName, sanitizeEmail, sanitizeJsonData } from "./utils/input-sanitizer";
import config from "./config/environment";
import monitoringRoutes from "./routes/monitoring";
import promptTestingRoutes from "./routes/prompt-testing";
import { 
  securityHeaders, 
  requestLogging, 
  errorHandler, 
  validateJsonPayload, 
  rateLimiter 
} from "./middleware/security";
import { requestMetricsMiddleware } from "./monitoring/metrics";

const app = express();

// Security and monitoring middleware
app.use(securityHeaders());
app.use(requestLogging());
app.use(requestMetricsMiddleware());
app.use(rateLimiter.middleware());

// Body parsing with validation
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(validateJsonPayload());

// API key authentication
const API_KEY = config.get().INTERNAL_API_KEY;

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // Allow health checks without auth
  if (req.path === '/health' || req.path === '/api/system/health') {
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

// Apply authentication to API routes
app.use('/api', authenticate);

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/system/health', async (req, res) => {
  try {
    const stats = await storage.getStats();
    const agents = await storage.getAgents();

    res.json({
      success: true,
      data: {
        status: "healthy",
        uptime: stats.uptime,
        memoryUsage: {
          heapUsed: Math.round(stats.memory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(stats.memory.heapTotal / 1024 / 1024)
        },
        agents: agents.map(a => ({ name: a.name, status: a.status })),
        totalLeads: stats.leads,
        totalActivities: stats.activities,
        timestamp: stats.timestamp
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Core API endpoints
app.get('/api/agents/status', async (req, res) => {
  try {
    const agents = await storage.getAgents();
    res.json({
      success: true,
      data: agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const activities = await storage.getActivities();
    res.json({
      success: true,
      data: activities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const leads = await storage.getLeads();
    res.json({
      success: true,
      data: leads,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post('/api/leads/process', async (req, res) => {
  try {
    const { email, vehicleInterest, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Email is required',
          category: 'validation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedData = sanitizeJsonData({ vehicleInterest, firstName, lastName });

    const lead = await storage.createLead({
      email: sanitizedEmail,
      status: 'new',
      leadData: sanitizedData
    });

    await storage.createActivity(
      'lead_processing',
      `Lead processed for ${sanitizedEmail.replace(/@.*/, '@...')}`,
      'LeadPackagingAgent',
      { leadId: lead.id }
    );

    res.json({
      success: true,
      data: {
        leadId: lead.id,
        message: 'Lead processed successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post('/api/email-campaigns/bulk-send', async (req, res) => {
  try {
    const { campaignName, data } = req.body;

    if (!campaignName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_001',
          message: 'Campaign name is required',
          category: 'validation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    const sanitizedCampaignName = sanitizeCampaignName(campaignName);
    const sanitizedData = sanitizeJsonData(data);

    await storage.createActivity(
      'bulk_campaign',
      `Bulk email campaign "${sanitizedCampaignName}" processed ${Array.isArray(sanitizedData) ? sanitizedData.length : 0} records`,
      'EmailReengagementAgent',
      { campaignName: sanitizedCampaignName, recordCount: Array.isArray(sanitizedData) ? sanitizedData.length : 0 }
    );

    res.json({
      success: true,
      data: {
        processed: Array.isArray(sanitizedData) ? sanitizedData.length : 0,
        message: `Campaign processed successfully`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Monitoring and testing routes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/test', promptTestingRoutes);

// Error handling middleware (must be last)
app.use(errorHandler());

const PORT = parseInt(process.env.PORT || "5000", 10);
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`CCL Agent System running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});

function shutdown() {
  console.log("Received termination signal. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed. Exiting process.");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

if (process.env.NODE_ENV === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}
