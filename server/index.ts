import "./db-fix"; // Assuming this contains critical DB setup or patches

import { Express, Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";

import { storage } from "./storage"; // Corrected import
import { logger } from "./logger";
import config from "./config/environment";
import { simpleCathyAgent } from "./agents/simple-cathy-agent";
import { campaignSender } from "./workers/campaign-sender";
import { mailgunService } from "./services/mailgun-service"; // For health check
import { storageService } from "./services/storage-service"; // For some stats/activities
import { createApp, AppConfig } from "./app"; // Import the new app creator

// Routes (simplified)
import campaignRoutes from "./routes/campaigns";
import webhookRoutes from "./routes/webhooks";
import dashboardRoutes from "./routes/dashboard"; // Basic dashboard stats
import { setupVite } from "./vite"; // For dev server

const PORT = config.get().PORT || 5000;

function configureDevRoutes(app: Express) {
  // Health Check
  app.get("/health", async (req: Request, res: Response) => {
    try {
      const dbHealth = await storage.healthCheck();
      const mailgunStatus = mailgunService.getStatus();
      const healthy = dbHealth.healthy && mailgunStatus.configured;

      res.status(healthy ? 200 : 503).json({
        status: healthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        database: dbHealth,
        mailgun: mailgunStatus,
        environment: config.get().NODE_ENV,
      });
    } catch (error) {
      logger.error({ error }, "Health check failed");
      res.status(503).json({
        status: "unhealthy",
        error: (error as Error).message,
      });
    }
  });

  // Leads API
  app.get("/api/leads", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const leads = await storage.getLeads(); // Using the main storage
      res.json(leads);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/leads", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, status, leadData } = req.body;
      if (!email || !status || !leadData) {
        return res.status(400).json({ error: "Missing required fields: email, status, leadData" });
      }
      if (typeof leadData !== "object" || leadData === null) {
        return res.status(400).json({ error: "leadData must be an object" });
      }
      const newLead = await storage.createLead({ email, status, leadData });
      res.status(201).json(newLead);
    } catch (error) {
      next(error);
    }
  });

  // Agents API
  app.get("/api/agents", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      next(error);
    }
  });

  // Chat API (using OpenRouter via simpleCathyAgent)
  app.post("/api/chat", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, sessionId } = req.body;
      if (!message || !sessionId) {
        return res.status(400).json({ error: "Missing required fields: message, sessionId" });
      }
      const responseText = await simpleCathyAgent.generateResponse(message, sessionId);
      await storageService.createActivity(
        "api_chat_message",
        `API Chat - User: "${message.substring(0, 50)}..."`,
        "api-chat-agent",
        { sessionId, responseLength: responseText.length }
      );
      res.json({ response: responseText });
    } catch (error) {
      next(error);
    }
  });

  // Simplified routes from previous setup
  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  // Vite setup for development
  // The `server` object needed by setupVite will be the one returned by `createApp`
  // We'll call this after createApp has initialized the HTTP server.
}

function configureDevWebSockets(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    logger.info("WebSocket client connected (Dev Server)");

    ws.on("message", async (messageBuffer: Buffer) => {
      try {
        const messageString = messageBuffer.toString();
        const parsedMessage = JSON.parse(messageString);

        if (parsedMessage.type === "chat" && parsedMessage.content && parsedMessage.sessionId) {
          const responseText = await simpleCathyAgent.generateResponse(
            parsedMessage.content,
            parsedMessage.sessionId
          );
          await storageService.createActivity(
            "ws_chat_message",
            `WS Chat - User: "${parsedMessage.content.substring(0, 50)}..."`,
            "ws-chat-agent",
            { sessionId: parsedMessage.sessionId, responseLength: responseText.length }
          );
          ws.send(
            JSON.stringify({
              type: "chat",
              sender: "agent",
              content: responseText,
              timestamp: new Date().toISOString(),
            })
          );
        } else {
          logger.warn(
            { receivedMessage: parsedMessage },
            "Received malformed WebSocket message (Dev Server)"
          );
          ws.send(JSON.stringify({ type: "error", content: "Invalid message format" }));
        }
      } catch (error) {
        logger.error({ error }, "Error processing WebSocket message (Dev Server)");
        ws.send(JSON.stringify({ type: "error", content: "Error processing message" }));
      }
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected (Dev Server)");
    });

    ws.on("error", (error: Error) => {
      logger.error({ error }, "WebSocket error (Dev Server)");
    });

    ws.send(
      JSON.stringify({
        type: "system",
        content: "Connected to CCL Chat Agent (Dev Server)",
        timestamp: new Date().toISOString(),
      })
    );
  });
}

async function onDevServerStart() {
  campaignSender.start();
  logger.info("Campaign sender worker started (Dev Server).");

  // Log other specific dev server info
  const mailgunStatus = mailgunService.getStatus();
  logger.info(
    `Mailgun configured: ${mailgunStatus.configured} (Domain: ${mailgunStatus.domain || "N/A"})`
  );
  logger.info(`OpenRouter configured: ${!!config.get().OPENROUTER_API_KEY}`);
}

async function onDevShutdown() {
  campaignSender.stop();
  logger.info("Campaign sender worker stopped (Dev Server).");
}

const devAppConfig: AppConfig = {
  appName: "CCL Agent System (Dev)",
  isProduction: false,
  corsOrigin: config.get().CORS_ORIGIN || "*",
  port: PORT,
  configureRoutes: configureDevRoutes,
  configureWebSockets: configureDevWebSockets,
  onServerStart: onDevServerStart,
  onShutdown: onDevShutdown,
};

// Create and start the application
const { app, server } = createApp(devAppConfig);

// Setup Vite *after* the server is created by createApp
setupVite(app, server);

// Export for potential testing if needed, though less critical now
export { app, server };
