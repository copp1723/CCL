import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { storage } from './database-storage';
import { setupVite, serveStatic } from './vite';
import { systemMonitor } from './services/error-monitor';
import { dbOptimizer } from './services/performance-optimizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Simple API key authentication for internal endpoints
const apiKeyAuth = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === 'ccl-internal-2025') {
    return next();
  }
  return res.status(401).json({
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

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: stats.uptime,
        memoryUsage: stats.memory,
        agents: [
          { name: 'VisitorIdentifierAgent', status: 'active' },
          { name: 'RealtimeChatAgent', status: 'active' },
          { name: 'EmailReengagementAgent', status: 'active' },
          { name: 'LeadPackagingAgent', status: 'active' }
        ],
        totalLeads: stats.leads,
        totalActivities: stats.activities,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = `session_${Date.now()}` } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        timestamp: new Date().toISOString()
      });
    }

    // Create visitor record
    const visitorId = await storage.createVisitor({
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { sessionId }
    });

    // Enhanced Cathy persona response
    let response = "Hi! I'm Cathy from Complete Car Loans. I understand you're looking for auto financing help. We specialize in working with all credit situations, including those who have been turned down elsewhere. Could you share your phone number so we can begin with a soft credit check that won't impact your credit score?";

    // Try OpenAI for enhanced responses
    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are Cathy, a warm and knowledgeable finance expert at Complete Car Loans. You specialize in helping people with all types of credit situations, especially sub-prime auto loans. Be empathetic, professional, and guide customers toward providing their phone number for a soft credit check.'
            },
            { role: 'user', content: message }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        response = data.choices[0]?.message?.content || response;
      }
    } catch (openaiError) {
      console.log('Using fallback response for chat');
    }

    // Log the interaction
    await storage.createActivity(
      'chat_interaction',
      `Chat message processed for session ${sessionId}`,
      'RealtimeChatAgent',
      { message: message.substring(0, 100), response: response.substring(0, 100) }
    );

    res.json({
      success: true,
      response,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Chat service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Lead processing endpoint
app.post('/api/process-lead', async (req, res) => {
  try {
    const { email, vehicleInterest, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
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
        message: 'Lead processed successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Lead processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Lead processing failed',
      timestamp: new Date().toISOString()
    });
  }
});

// System health endpoints (protected)
app.get('/api/system/health', apiKeyAuth, async (req, res) => {
  try {
    const stats = await storage.getStats();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: Math.round(process.uptime()),
        memoryUsage: process.memoryUsage(),
        errorRate: 0,
        agents: [
          { name: 'VisitorIdentifierAgent', status: 'active' },
          { name: 'RealtimeChatAgent', status: 'active' },
          { name: 'EmailReengagementAgent', status: 'active' },
          { name: 'LeadPackagingAgent', status: 'active' }
        ],
        totalLeads: stats.leads,
        totalActivities: stats.activities,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Health check failed' },
      timestamp: new Date().toISOString()
    });
  }
});

// Performance metrics endpoint (protected)
app.get('/api/system/performance', apiKeyAuth, async (req, res) => {
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
        recommendations: generateRecommendations(report, dbMetrics)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    systemMonitor.logError(error as Error, 'performance_check');
    res.status(500).json({
      success: false,
      error: { message: 'Performance check failed' },
      timestamp: new Date().toISOString()
    });
  }
});

function generateRecommendations(systemReport: any, dbMetrics: any): string[] {
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
  
  return recommendations.length > 0 ? recommendations : ['System performance is optimal'];
}

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const PORT = parseInt(process.env.PORT || '5000');

const server = createServer(app);

// WebSocket server for real-time chat
const wss = new WebSocketServer({ 
  server,
  path: '/ws/chat'
});

wss.on('connection', (ws, req) => {
  console.log('WebSocket connection established');
  
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || `session_${Date.now()}`;
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'chat') {
        // Process chat message using the same logic as HTTP endpoint
        const { content } = message;
        
        let response = "Hi! I'm Cathy from Complete Car Loans. I understand you're looking for auto financing help. We specialize in working with all credit situations. Could you share your phone number so we can begin with a soft credit check that won't impact your credit score?";

        try {
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4',
              messages: [
                {
                  role: 'system',
                  content: 'You are Cathy, a warm and knowledgeable finance expert at Complete Car Loans. You specialize in helping people with all types of credit situations, especially sub-prime auto loans. Be empathetic, professional, and guide customers toward providing their phone number for a soft credit check.'
                },
                { role: 'user', content }
              ],
              max_tokens: 300,
              temperature: 0.7
            })
          });

          if (openaiResponse.ok) {
            const data = await openaiResponse.json();
            response = data.choices[0]?.message?.content || response;
          }
        } catch (openaiError) {
          console.log('Using fallback response for WebSocket chat');
        }

        // Log the interaction
        await storage.createActivity(
          'websocket_chat',
          `WebSocket chat processed for session ${sessionId}`,
          'RealtimeChatAgent',
          { message: content.substring(0, 100), response: response.substring(0, 100) }
        );

        // Send response back to client
        ws.send(JSON.stringify({
          type: 'chat_response',
          response,
          sessionId,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Chat service temporarily unavailable',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    message: 'Connected to Complete Car Loans chat',
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`CCL Agent System running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws/chat`);
  
  // Setup Vite development server for frontend
  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
});

export default app;