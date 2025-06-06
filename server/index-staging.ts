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
const PORT = parseInt(process.env.PORT || "5000");

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
      message: 'Unauthorized access',
      category: 'authentication',
      retryable: false
    },
    timestamp: new Date().toISOString()
  });
};

// Apply authentication to all API routes
app.use('/api', authenticate);

// Health check endpoint (public)
app.get('/health', async (req, res) => {
  try {
    const stats = await storage.getStats();
    const agents = await storage.getAgents();
    
    res.json({
      status: 'healthy',
      environment: process.env.NODE_ENV || 'development',
      data: {
        uptime: Math.round(stats.uptime / 1000),
        memory: {
          used: Math.round(stats.memory.heapUsed / 1024 / 1024),
          total: Math.round(stats.memory.heapTotal / 1024 / 1024)
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

app.get('/api/metrics', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json({
      success: true,
      data: stats,
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
    if (!sanitizedEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_002',
          message: 'Invalid email format',
          category: 'validation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    const leadData = {
      email: sanitizedEmail,
      vehicleInterest: vehicleInterest || 'Not specified',
      firstName: firstName || '',
      lastName: lastName || '',
      source: 'api_direct',
      timestamp: new Date().toISOString()
    };

    const newLead = await storage.createLead({
      email: sanitizedEmail,
      status: 'new',
      leadData: sanitizeJsonData(leadData)
    });

    await storage.createActivity(
      'lead_created',
      `New lead created: ${sanitizedEmail}`,
      'system',
      { leadId: newLead.id, source: 'api_direct' }
    );

    res.json({
      success: true,
      data: {
        leadId: newLead.id,
        email: sanitizedEmail,
        status: 'processed',
        message: 'Lead created successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

app.post('/api/email-campaigns/bulk-send', async (req, res) => {
  try {
    const { campaignName, emailTemplate, targetSegment } = req.body;

    if (!campaignName || !emailTemplate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_003',
          message: 'Campaign name and email template are required',
          category: 'validation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      });
    }

    const sanitizedCampaignName = sanitizeCampaignName(campaignName);
    const leads = await storage.getLeads();
    const eligibleLeads = leads.filter(lead => 
      lead.status === 'new' || lead.status === 'contacted'
    );

    await storage.createActivity(
      'email_campaign_started',
      `Bulk email campaign "${sanitizedCampaignName}" initiated`,
      'email_agent',
      { 
        campaignName: sanitizedCampaignName,
        targetCount: eligibleLeads.length,
        template: emailTemplate 
      }
    );

    res.json({
      success: true,
      data: {
        campaignName: sanitizedCampaignName,
        emailsSent: eligibleLeads.length,
        status: 'initiated',
        message: 'Email campaign started successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    handleApiError(res, error);
  }
});

// Mount specialized routes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/test', promptTestingRoutes);

// Global error handler
app.use(errorHandler());

// Setup static file serving and Vite in development
async function startServer() {
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`CCL Agent System running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  });

  // Graceful shutdown
  function gracefulShutdown() {
    console.log('\nShutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return server;
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

startServer().catch(console.error);