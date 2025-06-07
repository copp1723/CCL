import express from 'express';
import path from 'path';
import cors from 'cors';
import config from './config/environment';
import { securityMonitor, requestLogging, errorHandler } from './middleware/security-consolidated';
import { authenticateToken, createAuthRoutes } from './middleware/auth';
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

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

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

// Catch-all for React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling
app.use(errorHandler());

const PORT = config.get().PORT;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CCL Agent System running on port ${PORT}`);
  console.log(`Environment: ${config.get().NODE_ENV}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});

export default app;