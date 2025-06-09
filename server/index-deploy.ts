// ================================================
// RENDER DEPLOYMENT - ULTRA ROBUST VERSION 
// ================================================

// Set port FIRST, before any imports
const PORT = parseInt(process.env.PORT || '5000', 10);
console.log(`🚀 RENDER FIX: Starting server on port ${PORT}`);
console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

// Create app and server IMMEDIATELY
const app = express();
const server = createServer(app);

// BIND TO PORT IMMEDIATELY - CRITICAL FOR RENDER
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ RENDER SUCCESS: Server listening on 0.0.0.0:${PORT}`);
  console.log(`🔍 Health check available at: http://0.0.0.0:${PORT}/health`);
  console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});

// Health check endpoint - MUST respond immediately
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    uptime: Math.round(process.uptime()),
    message: 'CCL Agent System is running'
  });
});

// Basic middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Basic API endpoints for immediate functionality
app.get('/api/system/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV,
    uptime: Math.round(process.uptime()),
    services: {
      database: 'checking...',
      agents: 'loading...',
      websocket: 'ready'
    }
  });
});

app.get('/api/agents', (req, res) => {
  res.json([
    {
      id: 'agent_1',
      name: 'VisitorIdentifierAgent',
      status: 'ready',
      processedToday: 0,
      description: 'Detects abandoned applications',
      icon: 'Users',
      color: 'text-blue-600'
    },
    {
      id: 'agent_2',
      name: 'RealtimeChatAgent',
      status: 'ready',
      processedToday: 0,
      description: 'Handles live customer chat',
      icon: 'MessageCircle',
      color: 'text-green-600'
    },
    {
      id: 'agent_3',
      name: 'EmailReengagementAgent',
      status: 'ready',
      processedToday: 0,
      description: 'Sends personalized email campaigns',
      icon: 'Mail',
      color: 'text-purple-600'
    },
    {
      id: 'agent_4',
      name: 'LeadPackagingAgent',
      status: 'ready',
      processedToday: 0,
      description: 'Packages leads for dealer submission',
      icon: 'Package',
      color: 'text-indigo-600'
    }
  ]);
});

app.get('/api/leads', (req, res) => {
  res.json([]);
});

app.get('/api/activities', (req, res) => {
  res.json([]);
});

// Chat endpoint
app.post('/api/chat', (req, res) => {
  try {
    const { message } = req.body;
    const response = "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

// Catch-all for unknown routes
app.use('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CCL Agent System</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .status { color: green; font-size: 24px; margin: 20px 0; }
          .info { color: #666; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>🚀 CCL Agent System</h1>
        <div class="status">✅ Server Running Successfully</div>
        <div class="info">Port: ${PORT}</div>
        <div class="info">Environment: ${process.env.NODE_ENV}</div>
        <div class="info">Started: ${new Date().toISOString()}</div>
        <div class="info">Uptime: ${Math.round(process.uptime())} seconds</div>
        <div class="info">
          <a href="/health">Health Check</a> | 
          <a href="/api/system/status">API Status</a>
        </div>
      </body>
      </html>
    `);
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// WebSocket setup (minimal and robust)
const wss = new WebSocketServer({ server, path: '/ws/chat' });
wss.on('connection', (ws) => {
  console.log('[WebSocket] Connection established');
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to CCL Assistant'
  }));
});

// Keep-alive logging for Render debugging
setInterval(() => {
  console.log(`🔄 Server alive on port ${PORT} - uptime: ${Math.round(process.uptime())}s`);
}, 30000); // Log every 30 seconds

console.log('🔄 Loading advanced services...');

// Initialize complex services AFTER server is confirmed running
setTimeout(async () => {
  try {
    console.log('🚀 Starting Campaign Sender Worker...');
    
    // Try to import and initialize advanced services with error handling
    let databaseConnected = false;
    let advancedServices = false;
    
    try {
      // Test database connection first
      if (process.env.DATABASE_URL) {
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000, // 5 second timeout
          idleTimeoutMillis: 10000, // 10 second idle timeout
        });
        
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        
        databaseConnected = true;
        console.log('✅ Database connection successful');
      } else {
        console.log('⚠️ No DATABASE_URL provided, skipping database services');
      }
    } catch (dbError) {
      console.log('⚠️ Database connection failed (non-critical):', dbError.message);
    }
    
    try {
      if (databaseConnected) {
        // Only load database-dependent services if database is available
        const { storage } = await import('./database-storage.js');
        const { storageService } = await import('./services/storage-service.js');
        const { campaignSender } = await import('./workers/campaign-sender');
        
        // Start background workers only if database is connected
        campaignSender.start();
        advancedServices = true;
        console.log('✅ Advanced services with database loaded successfully');
      }
    } catch (serviceError) {
      console.log('⚠️ Some advanced services failed to load (non-critical):', serviceError.message);
    }
    
    try {
      // Load non-database dependent services
      const { requestLogger } = await import('./middleware/logger.js');
      const { apiRateLimiter } = await import('./middleware/rate-limit.js');
      
      // Add middleware
      app.use(requestLogger);
      app.use(apiRateLimiter);
      
      console.log('✅ Basic middleware loaded successfully');
    } catch (middlewareError) {
      console.log('⚠️ Some middleware failed to load (non-critical):', middlewareError.message);
    }
    
    // Update status endpoint with real service status
    app.get('/api/system/status', (req, res) => {
      res.json({
        success: true,
        status: 'operational',
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV,
        uptime: Math.round(process.uptime()),
        services: {
          database: databaseConnected ? 'connected' : 'unavailable',
          agents: advancedServices ? 'active' : 'basic',
          websocket: 'ready'
        }
      });
    });
    
    console.log('✅ Service initialization complete');
    
  } catch (error) {
    console.error('⚠️ Advanced services failed to load (non-critical):', error);
    console.log('✅ Basic server continues to operate normally');
    // Don't crash - basic server still works
  }
}, 3000); // Wait 3 seconds after server is confirmed running

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export { app, server };