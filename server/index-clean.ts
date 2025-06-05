import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic } from "./vite";
import { handleApiError } from "./utils/error-handler";
import { storage } from "./database-storage";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false }));

// Simple API key authentication for internal use
const API_KEY = process.env.INTERNAL_API_KEY || "ccl-internal-2025";

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  
  // Allow health check without auth
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

// Centralized error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  handleApiError(res, err);
});

// Basic routes
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
    
    const lead = await storage.createLead({
      email,
      status: 'new',
      leadData: { vehicleInterest, firstName, lastName }
    });
    
    await storage.createActivity(
      'lead_processing',
      `Lead processed for ${email.replace(/@.*/, '@...')}`,
      'LeadPackagingAgent',
      { leadId: lead.id }
    );
    
    res.json({
      success: true,
      data: {
        leadId: lead.id,
        message: 'Lead processed and email automation triggered'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

const PORT = parseInt(process.env.PORT || "5000", 10);
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`CCL Agent System running on port ${PORT}`);
  console.log(`Database persistence enabled`);
  console.log(`API Key authentication: ${API_KEY}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
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