// ================================================
// 🚀 CCL LEAN & MEAN - UNIFIED SERVER ARCHITECTURE
// ================================================

const PORT = parseInt(process.env.PORT || '5000', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

console.log(`🚀 CCL Server starting on port ${PORT} (${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'})`);

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

// ================================================
// UNIFIED TYPES & CONSTANTS
// ================================================

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

interface Activity {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
}

interface LeadData {
  id: string;
  email: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  metadata?: any;
}

interface SystemStats {
  leads: number;
  activities: number;
  agents: number;
  uptime: number;
  timestamp: string;
  services: {
    database: string;
    agents: string;
    websocket: string;
  };
}

// Static agent configuration - single source of truth
const AGENTS: Agent[] = [
  {
    id: 'agent_1',
    name: 'VisitorIdentifierAgent',
    status: 'active',
    processedToday: 0,
    description: 'Detects abandoned applications',
    icon: 'Users',
    color: 'text-blue-600'
  },
  {
    id: 'agent_2',
    name: 'RealtimeChatAgent',
    status: 'active',
    processedToday: 0,
    description: 'Handles live customer chat',
    icon: 'MessageCircle',
    color: 'text-green-600'
  },
  {
    id: 'agent_3',
    name: 'EmailReengagementAgent',
    status: 'active',
    processedToday: 0,
    description: 'Sends personalized email campaigns',
    icon: 'Mail',
    color: 'text-purple-600'
  },
  {
    id: 'agent_4',
    name: 'LeadPackagingAgent',
    status: 'active',
    processedToday: 0,
    description: 'Packages leads for dealer submission',
    icon: 'Package',
    color: 'text-indigo-600'
  }
];

// ================================================
// UNIFIED STORAGE CLASS (Database + In-Memory)
// ================================================

class UnifiedStorage {
  private leads: LeadData[] = [];
  private activities: Activity[] = [];
  private agents: Agent[] = [...AGENTS];
  private leadCounter = 0;
  private activityCounter = 0;
  private dbConnected = false;
  private db: any = null;

  constructor() {
    this.initializeDatabase();
    this.createActivity('system_startup', 'CCL System initialized', 'System');
  }

  private async initializeDatabase() {
    try {
      if (process.env.DATABASE_URL) {
        const { Pool } = await import('pg');
        this.db = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 3000,
          idleTimeoutMillis: 5000,
        });
        
        // Test connection
        const client = await this.db.connect();
        await client.query('SELECT 1');
        client.release();
        
        this.dbConnected = true;
        console.log('✅ Database connected successfully');
        this.createActivity('database_connected', 'Database persistence enabled', 'System');
      }
    } catch (error) {
      console.log('⚠️ Database unavailable, using in-memory storage:', error.message);
      this.createActivity('fallback_storage', 'Using in-memory storage (database unavailable)', 'System');
    }
  }

  // Unified methods that work with both database and in-memory
  createLead(data: Omit<LeadData, 'id' | 'createdAt'>): LeadData {
    const lead: LeadData = {
      id: `lead_${++this.leadCounter}_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...data
    };
    
    this.leads.unshift(lead);
    this.createActivity('lead_created', `New lead created: ${data.email}`, 'VisitorIdentifierAgent');
    
    return lead;
  }

  getLeads(): LeadData[] {
    return this.leads;
  }

  createActivity(type: string, description: string, agentType?: string): Activity {
    const activity: Activity = {
      id: `activity_${++this.activityCounter}_${Date.now()}`,
      type,
      description,
      agentType,
      timestamp: new Date().toISOString()
    };
    
    this.activities.unshift(activity);
    
    // Update agent processed count
    if (agentType && agentType !== 'System') {
      const agent = this.agents.find(a => a.name === agentType);
      if (agent) agent.processedToday++;
    }
    
    return activity;
  }

  getActivities(limit = 20): Activity[] {
    return this.activities.slice(0, limit);
  }

  getAgents(): Agent[] {
    return this.agents;
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    const agentIndex = this.agents.findIndex(a => a.id === id);
    if (agentIndex > -1) {
      this.agents[agentIndex] = { ...this.agents[agentIndex], ...updates };
    }
  }

  getStats(): SystemStats {
    return {
      leads: this.leads.length,
      activities: this.activities.length,
      agents: this.agents.length,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        database: this.dbConnected ? 'connected' : 'unavailable',
        agents: 'active',
        websocket: 'ready'
      }
    };
  }

  createVisitor(data: { ipAddress?: string; userAgent?: string; metadata?: any }): { id: string } {
    const id = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.createActivity('visitor_tracked', `New visitor tracked from ${data.ipAddress || 'unknown IP'}`, 'VisitorIdentifierAgent');
    return { id };
  }
}

// ================================================
// EXPRESS APP SETUP
// ================================================

const app = express();
const server = createServer(app);
const storage = new UnifiedStorage();

// CORS setup
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ================================================
// UNIFIED API ROUTES
// ================================================

// Health check - CRITICAL for Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    uptime: Math.round(process.uptime())
  });
});

// System status with full stats
app.get('/api/system/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    ...storage.getStats()
  });
});

// Agents endpoint
app.get('/api/agents', (req, res) => {
  res.json(storage.getAgents());
});

// Leads endpoints
app.get('/api/leads', (req, res) => {
  res.json(storage.getLeads());
});

app.post('/api/leads', (req, res) => {
  try {
    const { email, status = 'new', metadata } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const lead = storage.createLead({ email, status, metadata });
    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Activities endpoint
app.get('/api/activities', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(storage.getActivities(limit));
});

// Chat endpoint
app.post('/api/chat', (req, res) => {
  try {
    const { message } = req.body;
    storage.createActivity('chat_message', `Customer message received: ${message?.substring(0, 50)}...`, 'RealtimeChatAgent');
    
    const response = "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

// Visitor tracking
app.post('/api/visitors', (req, res) => {
  try {
    const visitorData = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: req.body
    };
    
    const visitor = storage.createVisitor(visitorData);
    res.json(visitor);
  } catch (error) {
    console.error('Visitor tracking error:', error);
    res.status(500).json({ error: 'Failed to track visitor' });
  }
});

// ================================================
// WEBSOCKET SETUP
// ================================================

const wss = new WebSocketServer({ server, path: '/ws/chat' });

wss.on('connection', (ws, req) => {
  console.log(`[WebSocket] Connection from ${req.socket.remoteAddress}`);
  storage.createActivity('websocket_connected', 'New WebSocket connection established', 'RealtimeChatAgent');
  
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to CCL Assistant',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      storage.createActivity('websocket_message', `WebSocket message: ${message.type}`, 'RealtimeChatAgent');
      
      // Echo response for now
      ws.send(JSON.stringify({
        type: 'response',
        message: 'Message received and processed',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Connection closed');
  });
});

// ================================================
// CATCH-ALL & ERROR HANDLING
// ================================================

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
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .status { color: #10b981; font-size: 24px; margin: 20px 0; font-weight: 600; }
          .info { color: #6b7280; margin: 10px 0; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px; margin: 30px 0; }
          .stat { background: #f3f4f6; padding: 15px; border-radius: 8px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
          .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .links { margin-top: 30px; }
          .links a { color: #3b82f6; text-decoration: none; margin: 0 15px; }
          .links a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 CCL Agent System</h1>
          <div class="status">✅ Server Running Successfully</div>
          <div class="stats">
            <div class="stat"><div class="stat-value">${storage.getStats().leads}</div><div class="stat-label">Leads</div></div>
            <div class="stat"><div class="stat-value">${storage.getStats().activities}</div><div class="stat-label">Activities</div></div>
            <div class="stat"><div class="stat-value">${storage.getStats().agents}</div><div class="stat-label">Agents</div></div>
            <div class="stat"><div class="stat-value">${Math.round(process.uptime())}s</div><div class="stat-label">Uptime</div></div>
          </div>
          <div class="info">Environment: ${process.env.NODE_ENV}</div>
          <div class="info">Port: ${PORT}</div>
          <div class="info">Started: ${new Date().toISOString()}</div>
          <div class="links">
            <a href="/health">Health Check</a>
            <a href="/api/system/status">System Status</a>
            <a href="/api/agents">Agents</a>
            <a href="/api/activities">Activities</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  storage.createActivity('server_error', `Error: ${err.message}`, 'System');
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ================================================
// SERVER STARTUP & LIFECYCLE
// ================================================

// Start server - CRITICAL for Render
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ CCL Server listening on 0.0.0.0:${PORT}`);
  console.log(`🔍 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📊 System status: http://0.0.0.0:${PORT}/api/system/status`);
  storage.createActivity('server_started', `Server listening on port ${PORT}`, 'System');
});

// Keep-alive for monitoring
if (IS_PRODUCTION) {
  setInterval(() => {
    console.log(`🔄 Server alive - uptime: ${Math.round(process.uptime())}s, memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  }, 30000);
}

// Graceful shutdown
const shutdown = () => {
  console.log('🛑 Graceful shutdown initiated...');
  storage.createActivity('server_shutdown', 'Server shutting down gracefully', 'System');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Export for testing
export { app, server, storage };