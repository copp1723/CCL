import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import config from './config/environment';
import { securityMonitor, requestLogging, errorHandler } from './middleware/security-consolidated';
import { authenticateToken, createAuthRoutes } from './middleware/auth';
import { storage } from './database-storage';
import { setupVite, serveStatic } from './vite';
import emailCampaignsRouter from './routes/email-campaigns';
import promptTestingRouter from './routes/prompt-testing';
import dataIngestionRouter from './routes/data-ingestion-simple';
import monitoringRouter from './routes/monitoring';

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: config.get().CORS_ORIGIN,
  credentials: true
}));

// Security middleware
app.use(securityMonitor.securityHeadersMiddleware());
app.use(securityMonitor.ipBlockingMiddleware());
app.use(securityMonitor.rateLimitMiddleware());
app.use(securityMonitor.inputValidationMiddleware());
app.use(requestLogging());

// Development Vite integration or production static files
const isDevelopment = config.get().NODE_ENV === 'development';

// Auth routes (no auth required)
app.use('/api/auth', createAuthRoutes());

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      environment: config.get().NODE_ENV,
      timestamp: new Date().toISOString()
    }
  });
});

// Protected API routes
app.use('/api/email-campaigns', authenticateToken, emailCampaignsRouter);
app.use('/api/prompt-testing', authenticateToken, promptTestingRouter);
app.use('/api/data-ingestion', authenticateToken, dataIngestionRouter);
app.use('/api/monitoring', authenticateToken, monitoringRouter);

// Simple endpoints for dashboard
app.get('/api/metrics', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      totalLeads: 150,
      activeAgents: 3,
      campaignsActive: 2,
      conversionRate: 15.2
    }
  });
});

app.get('/api/agents/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: [
      { name: 'Email Re-engagement', status: 'active', lastActivity: new Date() },
      { name: 'Visitor Identifier', status: 'active', lastActivity: new Date() },
      { name: 'Realtime Chat', status: 'active', lastActivity: new Date() }
    ]
  });
});

app.get('/api/leads', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: 'John Doe', email: 'john@example.com', status: 'new', score: 85 },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'contacted', score: 92 }
    ]
  });
});

app.get('/api/activity', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, type: 'email_sent', description: 'Re-engagement email sent to John Doe', timestamp: new Date() },
      { id: 2, type: 'lead_scored', description: 'Lead score updated for Jane Smith', timestamp: new Date() }
    ]
  });
});

// Chat endpoint (no auth required for public access)
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

    // Create visitor record if needed
    const visitorId = await storage.createVisitor({
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { sessionId }
    });

    // Enhanced Cathy persona prompt with empathetic finance expertise
    const systemPrompt = `You are Cathy, a warm and knowledgeable finance expert at Complete Car Loans. You specialize in helping people with all types of credit situations, especially those who have been turned down elsewhere.

Your personality:
- Empathetic and understanding, never judgmental about past financial difficulties
- Confident and knowledgeable about auto financing options
- Friendly but professional
- Focused on helping people move forward, not dwelling on past mistakes

Your expertise:
- Sub-prime auto loans and credit rehabilitation
- Working with customers who have bad credit, no credit, bankruptcy, or repo history
- Explaining loan terms in simple, understandable language
- Guiding customers through the application process

Response guidelines:
- Keep responses conversational and encouraging
- Ask for phone number to begin the soft credit check process when appropriate
- Explain that soft credit checks don't hurt their credit score
- Emphasize Complete Car Loans' expertise with challenging credit situations
- Be helpful but guide toward getting their contact information for follow-up

Current message: "${message}"`;

    // Call OpenAI for intelligent response
    let response = "I understand you're looking for auto financing help. At Complete Car Loans, we specialize in working with all credit situations. Could you share your phone number so we can begin with a soft credit check that won't impact your credit score?";

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
            { role: 'system', content: systemPrompt },
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
      console.log('OpenAI fallback used for chat response');
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

// Error handling
app.use(errorHandler());

const PORT = config.get().PORT;
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`CCL Agent System running on port ${PORT}`);
  console.log(`Environment: ${config.get().NODE_ENV}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  
  // Setup Vite development server for frontend
  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
});

export default app;