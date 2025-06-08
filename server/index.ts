import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import cors from 'cors';
import { storage } from './database-storage.js';
import { storageService } from './services/storage-service.js';
import { requestLogger } from './middleware/logger.js';
import { apiRateLimiter } from './middleware/rate-limit.js';
import { setupVite, serveStatic } from './vite.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware - Order matters!
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, res, buf) => {
    if (buf.length > 10 * 1024 * 1024) {
      throw new Error('Request too large');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100
}));

// Add our new security middleware first
app.use(requestLogger);
app.use(apiRateLimiter);

// CORS configuration
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Input sanitization middleware
const sanitizeInput = (req: any, res: any, next: any) => {
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /\.\./g, // Path traversal
    /union\s+select/gi,
    /drop\s+table/gi,
    /insert\s+into/gi,
    /delete\s+from/gi
  ];

  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(obj)) {
          return res.status(400).json({
            error: 'Invalid input detected',
            code: 'SECURITY_VIOLATION'
          });
        }
      }
      return obj.trim();
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) {
    try {
      req.body = sanitize(req.body);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid request data',
        code: 'SANITIZATION_ERROR'
      });
    }
  }

  if (req.query) {
    try {
      req.query = sanitize(req.query);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        code: 'SANITIZATION_ERROR'
      });
    }
  }

  next();
};

app.use(sanitizeInput);

// API Key validation middleware
const apiKeyAuth = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validApiKey = process.env.CCL_API_KEY || process.env.FLEXPATH_API_KEY;
  
  if (!validApiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid API key required'
    });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// System stats endpoint (protected)
app.get('/api/system/stats', apiKeyAuth, async (req, res) => {
  try {
    // Use the improved storageService for stats
    const stats = await storageService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Leads endpoints - Using improved storageService
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await storageService.getLeads();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leads' });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const { email, phoneNumber, status = 'new', leadData } = req.body;
    const lead = await storageService.createLead({ email, phoneNumber, status, leadData });
    res.json({ success: true, data: lead });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create lead' });
  }
});

// Activities endpoint - Using improved storageService
app.get('/api/activities', async (req, res) => {
  try {
    const activities = await storageService.getActivities(20);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch activities' });
  }
});

// Agents endpoint
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await storage.getAgents();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// Chat endpoint with concise Cathy responses
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    let response = "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";

    if (process.env.OPENAI_API_KEY) {
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
                content: 'You are Cathy from Complete Car Loans. Keep responses under 50 words. Be warm but concise. Focus on: 1) Understanding their auto financing needs 2) Getting their phone number for soft credit check 3) Reassuring about credit acceptance. Avoid lengthy explanations.'
              },
              { role: 'user', content: message }
            ],
            max_tokens: 150,
            temperature: 0.7
          })
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          response = data.choices[0]?.message?.content || response;
        }
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError);
      }
    }

    await storageService.createActivity(
      'chat_message',
      `Chat interaction - User: "${message.substring(0, 30)}..." Response provided by Cathy`,
      'chat-agent',
      { messageLength: message.length, responseLength: response.length }
    );

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

// CSV upload endpoint
app.post('/api/bulk-email/send', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file provided' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    let processed = 0;
    const campaignId = `campaign_${Date.now()}`;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= headers.length) {
        const leadData: any = {};
        headers.forEach((header, index) => {
          leadData[header] = values[index]?.trim();
        });

        if (leadData.email) {
          await storageService.createLead({
            email: leadData.email,
            phoneNumber: leadData.phone || leadData.phonenumber,
            status: 'new',
            leadData
          });
          processed++;
        }
      }
    }

    await storageService.createActivity(
      'csv_upload',
      `CSV upload completed - ${processed} leads processed`,
      'data-ingestion',
      { campaignId, processed, fileName: req.file.originalname }
    );

    res.json({
      success: true,
      data: { processed, campaignId },
      message: `Successfully processed ${processed} leads`
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to process CSV file' });
  }
});

// Campaign endpoints
app.get('/api/bulk-email/campaigns', async (req, res) => {
  try {
    res.json({
      success: true,
      data: [
        {
          id: 'demo_campaign_1',
          name: 'Welcome Series',
          status: 'active',
          totalRecipients: 150,
          emailsSent: 145,
          openRate: 0.35,
          clickRate: 0.12,
          createdAt: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
  }
});

app.get('/api/bulk-email/settings', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        timing: {
          step1Delay: 24,
          step2Delay: 72,
          step3Delay: 168
        },
        mailgun: {
          domain: process.env.MAILGUN_DOMAIN || 'sandbox.mailgun.org',
          status: process.env.MAILGUN_API_KEY ? 'connected' : 'not_configured'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// Create HTTP server
const server = createServer(app);

// Simple WebSocket implementation
const wss = new WebSocketServer({ server, path: '/ws/chat' });

wss.on('connection', (ws) => {
  console.log('[WebSocket] New connection established');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'chat') {
        const cathyResponses = [
          "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?",
          "I understand financing can be stressful. Let me see what options we have for you.",
          "We specialize in helping people with all credit situations. What's your main concern?",
          "Would you like me to check your pre-approval status? It only takes a minute.",
          "I'm here to make this process as smooth as possible. What questions do you have?"
        ];
        
        const response = cathyResponses[Math.floor(Math.random() * cathyResponses.length)];
        
        await storageService.createActivity(
          'chat_message',
          `WebSocket chat - User: "${message.content.substring(0, 30)}..." Response provided by Cathy`,
          'realtime-chat',
          { messageLength: message.content.length, responseLength: response.length }
        );

        ws.send(JSON.stringify({
          type: 'chat',
          message: response,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('[WebSocket] Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Sorry, I encountered an error processing your message.'
      }));
    }
  });

  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to CCL Assistant'
  }));
});

// Setup Vite in development
if (process.env.NODE_ENV !== 'production') {
  setupVite(app, server);
} else {
  serveStatic(app);
}

const PORT = parseInt(process.env.PORT || '5000', 10);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CCL Agent System running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws/chat`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});