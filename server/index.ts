import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic } from "./vite";
import { handleApiError } from "./utils/error-handler";
import { storage } from "./database-storage";
import { sanitizeCampaignName, sanitizeEmail, sanitizeJsonData } from "./utils/input-sanitizer";
import { systemMonitor } from "./services/error-monitor";
import { dbOptimizer } from "./services/performance-optimizer";
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

// Request monitoring for error tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  systemMonitor.logRequest();
  next();
});

// Body parsing with validation
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(validateJsonPayload());

// API key authentication
const API_KEY = config.get().INTERNAL_API_KEY;

// Import the simplified Cathy agent
import { simpleCathyAgent } from './agents/simple-cathy-agent';

// Enhanced Cathy response generator with error handling
async function generateCathyResponse(message: string, sessionId: string): Promise<string> {
  try {
    const startTime = Date.now();
    const response = await simpleCathyAgent.generateResponse(message, sessionId);
    const responseTime = Date.now() - startTime;
    
    // Log slow responses
    if (responseTime > 5000) {
      systemMonitor.logError(new Error(`Slow OpenAI response: ${responseTime}ms`), 'chat_performance');
    }
    
    return response;
  } catch (error) {
    systemMonitor.logError(error as Error, 'openai_chat');
    
    // Enhanced fallback with context awareness
    const contextualResponse = generateContextualFallback(message, sessionId);
    
    await storage.createActivity(
      'chat_fallback',
      `OpenAI error, using fallback response for session ${sessionId}`,
      'RealtimeChatAgent',
      { originalMessage: message, error: (error as Error).message }
    );
    
    return contextualResponse;
  }
}

// Enhanced contextual fallback responses
function generateContextualFallback(message: string, sessionId: string): string {
  const lowerMsg = message.toLowerCase();
  
  // Phone number collection priority
  if (lowerMsg.includes('phone') || lowerMsg.includes('number') || lowerMsg.includes('call')) {
    return "Perfect! To get your pre-approval started, I'll need your phone number. This helps us verify your identity for the soft credit check. What's the best number to reach you?";
  }
  
  // Credit concerns - empathetic approach
  if (lowerMsg.includes('bad credit') || lowerMsg.includes('poor credit') || lowerMsg.includes('bankruptcy') || lowerMsg.includes('repo')) {
    return "I completely understand your concern. I work exclusively with customers in all credit situations - that's exactly what Complete Car Loans specializes in. What type of vehicle are you hoping to get into?";
  }
  
  // Application process
  if (lowerMsg.includes('apply') || lowerMsg.includes('approved') || lowerMsg.includes('approval') || lowerMsg.includes('pre-approve')) {
    return "Absolutely! I can start your pre-approval right now. It takes under 2 minutes, won't affect your credit score, and you'll know exactly what you qualify for. Ready to begin?";
  }
  
  // Payment and rate questions
  if (lowerMsg.includes('payment') || lowerMsg.includes('rate') || lowerMsg.includes('interest') || lowerMsg.includes('monthly')) {
    return "Great question! Your exact payment and rate depend on the vehicle price and your specific situation. Once we get you pre-approved, I can show you exactly what your payments would be. Should we start that process?";
  }
  
  // Vehicle interest
  if (lowerMsg.includes('car') || lowerMsg.includes('truck') || lowerMsg.includes('suv') || lowerMsg.includes('vehicle')) {
    return "Exciting! Getting pre-approved first gives you the strongest negotiating position at the dealership. Plus, you'll know your exact budget before you start shopping. Can I get you pre-approved today?";
  }
  
  // Default empathetic response
  return "I'm here to help you get the auto financing you need, regardless of your credit situation. Complete Car Loans specializes in approvals for everyone. What questions can I answer about getting you pre-approved today?";
}

// Simple fallback for backward compatibility
function generateConciseResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    return "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";
  }
  
  if (lowerMsg.includes('apply') || lowerMsg.includes('approved') || lowerMsg.includes('approval')) {
    return "Great! I can start your pre-approval right now. It takes under 2 minutes and won't affect your credit score. Ready?";
  }
  
  if (lowerMsg.includes('bad credit') || lowerMsg.includes('poor credit')) {
    return "No worries at all! I specialize in all credit situations. What type of vehicle are you looking for?";
  }
  
  if (lowerMsg.includes('rate') || lowerMsg.includes('payment')) {
    return "Rates depend on your profile, but let's get you pre-approved first to see your exact options. Sound good?";
  }
  
  if (lowerMsg.includes('car') || lowerMsg.includes('vehicle') || lowerMsg.includes('truck')) {
    return "Exciting! Getting pre-approved first gives you the best negotiating power. Should we start the process?";
  }
  
  return "I'm here to help with auto financing for any credit situation. What questions do you have?";
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
    const aiResponse = await generateCathyResponse(message, sessionId);
    
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



// Enhanced system health endpoints
app.get('/api/system/health', async (req, res) => {
  try {
    const health = systemMonitor.getHealthStatus();
    const performance = dbOptimizer.getPerformanceMetrics();
    const stats = await storage.getStats();
    
    res.json({
      success: true,
      data: {
        status: health.status,
        uptime: health.uptime,
        memoryUsage: health.memoryUsage,
        errorRate: health.errorRate,
        lastError: health.lastError,
        performance: performance.queryPerformance,
        cache: performance.cache,
        systemStats: stats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    systemMonitor.logError(error as Error, 'health_check');
    res.status(500).json({
      success: false,
      error: { message: 'Health check failed' },
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/system/performance', async (req, res) => {
  try {
    const report = systemMonitor.getPerformanceReport();
    const dbMetrics = dbOptimizer.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: {
        systemHealth: report.health,
        errorMetrics: report.topErrors,
        databasePerformance: dbMetrics.queryPerformance,
        cacheStats: dbMetrics.cache,
        recommendations: generatePerformanceRecommendations(report, dbMetrics)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    systemMonitor.logError(error as Error, 'performance_check');
    handleApiError(res, error);
  }
});

function generatePerformanceRecommendations(systemReport: any, dbMetrics: any): string[] {
  const recommendations = [];
  
  if (systemReport.health.errorRate > 5) {
    recommendations.push('High error rate detected - investigate recent changes');
  }
  
  if (systemReport.health.memoryUsage.heapUsed > 150) {
    recommendations.push('Memory usage elevated - consider cache optimization');
  }
  
  for (const [operation, metrics] of Object.entries(dbMetrics.queryPerformance)) {
    if ((metrics as any).avgMs > 500) {
      recommendations.push(`Slow database queries detected in ${operation} - review indexing`);
    }
  }
  
  if (dbMetrics.cache.size > 100) {
    recommendations.push('Large cache size - consider cache cleanup or TTL adjustment');
  }
  
  return recommendations.length > 0 ? recommendations : ['System performance is optimal'];
}

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