import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketManager } from "./services/websocket";
import { initializeAgentOrchestrator, agentOrchestrator } from "./agents";
import { emailReengagementService } from "./agents/email-reengagement";
import { visitorIdentifierService, type AbandonmentEvent } from "./agents/visitor-identifier";
import { generateSessionId } from "./services/token";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(httpServer);
  
  // Initialize agent orchestrator
  initializeAgentOrchestrator(wsManager);

  // API Routes

  // Dashboard metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await agentOrchestrator.getAgentMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error getting metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // Agent statuses
  app.get("/api/agents/status", async (req, res) => {
    try {
      const statuses = await agentOrchestrator.getAgentStatuses();
      res.json(statuses);
    } catch (error) {
      console.error('Error getting agent statuses:', error);
      res.status(500).json({ error: 'Failed to get agent statuses' });
    }
  });

  // Recent activity feed
  app.get("/api/activity", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activities = await storage.getRecentAgentActivity(limit);
      res.json(activities);
    } catch (error) {
      console.error('Error getting activity:', error);
      res.status(500).json({ error: 'Failed to get activity' });
    }
  });

  // Recent leads
  app.get("/api/leads", async (req, res) => {
    try {
      const status = req.query.status as string;
      const leads = status 
        ? await storage.getLeadsByStatus(status)
        : await storage.getLeadsByStatus('submitted');
      
      // Get recent leads (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLeads = leads
        .filter(lead => lead.createdAt > yesterday)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      res.json(recentLeads);
    } catch (error) {
      console.error('Error getting leads:', error);
      res.status(500).json({ error: 'Failed to get leads' });
    }
  });

  // Simulate abandonment event (for testing)
  app.post("/api/abandonment", async (req, res) => {
    try {
      const { email, step, sessionId } = req.body;
      
      if (!email || !step) {
        return res.status(400).json({ error: 'Email and step are required' });
      }

      const event: AbandonmentEvent = {
        sessionId: sessionId || generateSessionId(),
        email,
        step: parseInt(step),
        timestamp: new Date(),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      };

      await visitorIdentifierService.processAbandonmentEvent(event);
      
      res.json({ success: true, message: 'Abandonment event processed' });
    } catch (error) {
      console.error('Error processing abandonment:', error);
      res.status(500).json({ error: 'Failed to process abandonment event' });
    }
  });

  // Email return token validation
  app.get("/api/email/return/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const validation = await emailReengagementService.validateReturnToken(token);
      
      if (validation.valid) {
        // Track email click
        await emailReengagementService.handleEmailEngagement(token, 'clicked');
        
        // In a real app, redirect to continue application page
        res.json({ 
          valid: true, 
          visitorId: validation.visitorId,
          redirectUrl: `/continue-application?token=${token}` 
        });
      } else {
        res.status(400).json({ valid: false, error: 'Invalid or expired token' });
      }
    } catch (error) {
      console.error('Error validating return token:', error);
      res.status(500).json({ error: 'Failed to validate token' });
    }
  });

  // Email tracking pixel
  app.get("/api/email/pixel/:campaignId/:token.gif", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Track email open
      await emailReengagementService.handleEmailEngagement(token, 'opened');
      
      // Return 1x1 transparent GIF
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', pixel.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end(pixel);
    } catch (error) {
      console.error('Error tracking email pixel:', error);
      res.status(200).end(); // Always return 200 for tracking pixels
    }
  });

  // Email click tracking
  app.get("/api/email/click/:campaignId/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { url } = req.query;
      
      // Track email click
      await emailReengagementService.handleEmailEngagement(token, 'clicked');
      
      // Redirect to original URL
      if (url && typeof url === 'string') {
        res.redirect(decodeURIComponent(url));
      } else {
        res.redirect('/');
      }
    } catch (error) {
      console.error('Error tracking email click:', error);
      res.redirect('/'); // Always redirect somewhere
    }
  });

  // Get visitor by session
  app.get("/api/visitor/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const visitor = await storage.getVisitorBySessionId(sessionId);
      
      if (visitor) {
        res.json(visitor);
      } else {
        res.status(404).json({ error: 'Visitor not found' });
      }
    } catch (error) {
      console.error('Error getting visitor:', error);
      res.status(500).json({ error: 'Failed to get visitor' });
    }
  });

  // Get chat session messages
  app.get("/api/chat/:sessionId/messages", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const chatSession = await storage.getChatSessionBySessionId(sessionId);
      
      if (chatSession) {
        res.json({ messages: chatSession.messages || [] });
      } else {
        res.status(404).json({ error: 'Chat session not found' });
      }
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({ error: 'Failed to get chat messages' });
    }
  });

  // WebSocket connection count
  app.get("/api/websocket/stats", (req, res) => {
    res.json({
      connectedSessions: wsManager.getConnectedSessions(),
      clientCount: wsManager.getClientCount(),
    });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agents: {
        visitorIdentifier: 'active',
        emailReengagement: 'active',
        realtimeChat: 'active',
        creditCheck: 'active',
        leadPackaging: 'active',
      },
      websocket: {
        connected: wsManager.getClientCount(),
      },
    });
  });

  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  });

  return httpServer;
}
