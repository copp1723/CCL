import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic } from "./vite";
import { handleApiError } from "./utils/error-handler";
import { storage } from "./database-storage";
import { sanitizeCampaignName, sanitizeEmail, sanitizeJsonData } from "./utils/input-sanitizer";
import config from "./config/environment";
import monitoringRoutes from "./routes/monitoring";
import promptTestingRoutes from "./routes/prompt-testing";
import stagingDeploymentRoutes from "./routes/staging-deployment";
import emailCampaignRoutes from "./routes/email-campaigns";
import dataIngestionRoutes from "./routes/data-ingestion-simple";
import { 
  securityHeaders, 
  requestLogging, 
  errorHandler, 
  validateJsonPayload, 
  rateLimiter 
} from "./middleware/security";
import { requestMetricsMiddleware } from "./monitoring/metrics";
import { validateEnvironment } from './config/env-validation';
import path from 'path';

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

// Cathy's response generator function
function generateCathyResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  
  // Detect emotional tone and respond with empathy
  if (lowerMsg.includes('frustrated') || lowerMsg.includes('denied') || lowerMsg.includes('rejected')) {
    return "I completely understand how frustrating that experience must have been. You're not alone in this - I work specifically with people in all credit situations, and I've helped many customers who felt exactly like you do right now. Let's see what options we can explore together. What's been your biggest concern about getting approved?";
  }
  
  if (lowerMsg.includes('urgent') || lowerMsg.includes('need asap') || lowerMsg.includes('quickly')) {
    return "I hear the urgency in your message, and I'm here to help you move quickly. I specialize in getting people pre-approved efficiently, often within minutes. Our soft credit check won't impact your score, and we work with all credit situations. What's driving the timeline - did you find a vehicle you love?";
  }
  
  if (lowerMsg.includes('bad credit') || lowerMsg.includes('poor credit') || lowerMsg.includes('credit problems')) {
    return "I'm so glad you reached out! I want you to know that I work exclusively with customers in all credit situations - that's exactly my specialty. Many of my most successful customers started exactly where you are. Credit challenges don't define your options; they just help me find the right path for you. What kind of vehicle are you hoping to get?";
  }
  
  if (lowerMsg.includes('rate') || lowerMsg.includes('payment') || lowerMsg.includes('monthly')) {
    return "That's exactly the right question to ask! Your rate and payment will depend on a few factors like your credit profile, the vehicle you choose, and loan term. The great news is that our current rates start as low as 3.9% APR for qualified customers, and we have programs for all credit situations. Our soft credit check takes just a moment and won't impact your score at all. Would you like me to check what specific rate and payment you'd qualify for?";
  }
  
  if (lowerMsg.includes('apply') || lowerMsg.includes('application') || lowerMsg.includes('process')) {
    return "I love that you're ready to move forward! The process is actually much simpler than most people expect. We start with a quick, soft credit check that won't affect your score, then I can show you exactly what you qualify for. The whole pre-approval usually takes less than 2 minutes. Once you're pre-approved, you'll know your exact buying power before you even look at vehicles. Should we get your pre-approval started?";
  }
  
  if (lowerMsg.includes('car') || lowerMsg.includes('truck') || lowerMsg.includes('suv') || lowerMsg.includes('vehicle')) {
    return "It sounds like you're getting excited about your next vehicle - I love that energy! Whether you're looking at something specific or still exploring options, getting pre-approved first is always the smart move. It gives you real negotiating power and helps you shop with confidence. Plus, our financing often beats dealer rates. Have you been looking at anything particular, or are you still in the browsing stage?";
  }
  
  // Default warm welcome
  return "Hi there! I'm Cathy, your finance expert at Complete Car Loans. I specialize in helping customers like you find the best financing options, no matter your credit history. I'm here to make this process as easy as possible for you. What brings you here today - are you looking to get pre-approved for a vehicle, or do you have questions about our financing options?";
}

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // Allow health checks and chat without auth
  if (req.path === '/health' || req.path === '/api/system/health' || req.path === '/api/chat') {
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

// Public chat endpoint (must be before auth middleware)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    // Generate Cathy's response
    const lowerMsg = message.toLowerCase();
    let aiResponse = "Hi there! I'm Cathy, your finance expert at Complete Car Loans. I specialize in helping customers like you find the best financing options, no matter your credit history. I'm here to make this process as easy as possible for you. What brings you here today - are you looking to get pre-approved for a vehicle, or do you have questions about our financing options?";
    
    if (lowerMsg.includes('frustrated') || lowerMsg.includes('denied') || lowerMsg.includes('rejected')) {
      aiResponse = "I completely understand how frustrating that experience must have been. You're not alone in this - I work specifically with people in all credit situations, and I've helped many customers who felt exactly like you do right now. Let's see what options we can explore together. What's been your biggest concern about getting approved?";
    } else if (lowerMsg.includes('bad credit') || lowerMsg.includes('poor credit') || lowerMsg.includes('credit problems')) {
      aiResponse = "I'm so glad you reached out! I want you to know that I work exclusively with customers in all credit situations - that's exactly my specialty. Many of my most successful customers started exactly where you are. Credit challenges don't define your options; they just help me find the right path for you. What kind of vehicle are you hoping to get?";
    } else if (lowerMsg.includes('rate') || lowerMsg.includes('payment') || lowerMsg.includes('monthly')) {
      aiResponse = "That's exactly the right question to ask! Your rate and payment will depend on a few factors like your credit profile, the vehicle you choose, and loan term. The great news is that our current rates start as low as 3.9% APR for qualified customers, and we have programs for all credit situations. Our soft credit check takes just a moment and won't impact your score at all. Would you like me to check what specific rate and payment you'd qualify for?";
    } else if (lowerMsg.includes('apply') || lowerMsg.includes('application') || lowerMsg.includes('process')) {
      aiResponse = "I love that you're ready to move forward! The process is actually much simpler than most people expect. We start with a quick, soft credit check that won't affect your score, then I can show you exactly what you qualify for. The whole pre-approval usually takes less than 2 minutes. Once you're pre-approved, you'll know your exact buying power before you even look at vehicles. Should we get your pre-approval started?";
    } else if (lowerMsg.includes('car') || lowerMsg.includes('truck') || lowerMsg.includes('suv') || lowerMsg.includes('vehicle')) {
      aiResponse = "It sounds like you're getting excited about your next vehicle - I love that energy! Whether you're looking at something specific or still exploring options, getting pre-approved first is always the smart move. It gives you real negotiating power and helps you shop with confidence. Plus, our financing often beats dealer rates. Have you been looking at anything particular, or are you still in the browsing stage?";
    }
    
    // Check if a phone number was captured
    const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const phoneMatch = message.match(phoneRegex);
    
    if (phoneMatch) {
      // Create visitor record with phone number
      await storage.createVisitor({
        phoneNumber: phoneMatch[0],
        metadata: { sessionId, capturedViaChat: true }
      });
      
      await storage.createActivity(
        'phone_capture',
        `Phone number captured via chat: ${phoneMatch[0]}`,
        'RealtimeChatAgent',
        { sessionId, phoneNumber: phoneMatch[0] }
      );
    }

    res.json({
      success: true,
      response: aiResponse,
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    res.status(500).json({
      success: false,
      response: "I'm sorry, I'm experiencing some technical difficulties right now. Please try again in a moment.",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Apply authentication to protected API routes
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
app.use('/api/staging', stagingDeploymentRoutes);
app.use('/api/email-campaigns', emailCampaignRoutes);
app.use('/api/data-ingestion', dataIngestionRoutes);

// Error handling middleware (must be last)
app.use(errorHandler());

// Validate environment before starting
const env = validateEnvironment();
const PORT = env.PORT;
const server = app.listen(PORT, '0.0.0.0', () => {
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

// Serve static files from the client build
const staticPath = path.join(import.meta.dirname, '../dist/public');
app.use(express.static(staticPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
  etag: true
}));