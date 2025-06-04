import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketService } from "./services/websocket";
import { agentOrchestrator } from "./agents";

let websocketService: WebSocketService;

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Initialize WebSocket service
  websocketService = new WebSocketService(httpServer);

  // API Routes
  
  // Dashboard metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.getAllMetrics();
      const agents = await storage.getAllAgents();
      const activeConnections = websocketService.getActiveConnections();

      // Update real-time metrics
      await storage.createOrUpdateMetric({
        name: "activeChatSessions",
        value: activeConnections.toString(),
        type: "count"
      });

      const metricsMap = metrics.reduce((acc, metric) => {
        acc[metric.name] = metric;
        return acc;
      }, {} as Record<string, any>);

      res.json({
        metrics: metricsMap,
        agents: agents.length,
        activeConnections,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Agent status
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  // Recent activities
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Recent leads
  app.get("/api/leads", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leads = await storage.getRecentLeads(limit);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Chat session management
  app.post("/api/chat/session", async (req, res) => {
    try {
      const { sessionId, returnToken } = req.body;
      
      let session = await storage.getChatSession(sessionId);
      if (!session) {
        session = await storage.createChatSession({
          sessionId,
          returnToken,
          isActive: true,
        });
      }

      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  // Get chat messages
  app.get("/api/chat/:sessionId/messages", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessages(sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // Process abandonment event (normally from SQS)
  app.post("/api/abandonment", async (req, res) => {
    try {
      const { sessionId, email } = req.body;
      
      if (!sessionId || !email) {
        return res.status(400).json({ error: "Missing sessionId or email" });
      }

      await agentOrchestrator.processAbandonmentEvent(sessionId, email);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process abandonment event" });
    }
  });

  // Return token validation
  app.get("/api/return-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const returnToken = await storage.getReturnToken(token);
      
      if (!returnToken) {
        return res.status(404).json({ error: "Token not found" });
      }

      if (returnToken.expiresAt < new Date()) {
        return res.status(410).json({ error: "Token expired" });
      }

      if (returnToken.isUsed) {
        return res.status(410).json({ error: "Token already used" });
      }

      res.json({
        valid: true,
        visitorId: returnToken.visitorId,
        expiresAt: returnToken.expiresAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate token" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        agents: "operational",
        websocket: "operational",
        storage: "operational",
      },
    });
  });

  // Start periodic metrics updates
  setInterval(async () => {
    try {
      // Update metrics in real-time
      const agents = await storage.getAllAgents();
      const leads = await storage.getRecentLeads(1000);
      const activities = await storage.getRecentActivities(100);

      const todayLeads = leads.filter(
        lead => lead.createdAt.toDateString() === new Date().toDateString()
      ).length;

      const approvedLeads = leads.filter(lead => lead.creditStatus === 'approved').length;
      const approvalRate = leads.length > 0 ? (approvedLeads / leads.length) * 100 : 0;

      // Update metrics
      await storage.createOrUpdateMetric({
        name: "leadsToday",
        value: todayLeads.toString(),
        type: "count"
      });

      await storage.createOrUpdateMetric({
        name: "approvalRate",
        value: approvalRate.toFixed(1),
        type: "percentage"
      });

      await storage.createOrUpdateMetric({
        name: "recentActivities",
        value: activities.length.toString(),
        type: "count"
      });

      // Broadcast metrics to connected clients
      const allMetrics = await storage.getAllMetrics();
      websocketService.broadcastMetrics(
        allMetrics.reduce((acc, metric) => {
          acc[metric.name] = metric.value;
          return acc;
        }, {} as Record<string, string>)
      );
    } catch (error) {
      console.error("Error updating metrics:", error);
    }
  }, 10000); // Update every 10 seconds

  return httpServer;
}
