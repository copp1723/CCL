import "./db-fix"; // Assuming this contains critical DB setup or patches

import express, { Request, Response, NextFunction } from "express";
import { createServer, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";

import { storage } from "./storage"; // Corrected import
import { logger } from "./logger";
import config from "./config/environment";
import { simpleCathyAgent } from "./agents/simple-cathy-agent";
import { campaignSender } from "./workers/campaign-sender";
import { mailgunService } from "./services/mailgun-service"; // For health check
import { storageService } from "./services/storage-service"; // For some stats/activities

// Routes (simplified)
import campaignRoutes from "./routes/campaigns";
import webhookRoutes from "./routes/webhooks";
import dashboardRoutes from "./routes/dashboard"; // Basic dashboard stats

const app = express();
const server: HttpServer = createServer(app);
const PORT = config.get().PORT || 5000;

// --- Middleware ---
app.use(cors({
  origin: config.get().CORS_ORIGIN || "*", // Use configured CORS origin
  credentials: true,
}));
app.use(express.json({ limit: "1mb" })); // Reduced limit for minimal server
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Simple request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// --- API Routes ---

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
    // Ensure leadData is an object
    if (typeof leadData !== 'object' || leadData === null) {
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
    const response = await simpleCathyAgent.generateResponse(message, sessionId);
    await storageService.createActivity(
      "api_chat_message",
      `API Chat - User: "${message.substring(0,50)}..."`,
      "api-chat-agent",
      { sessionId, responseLength: response.length }
    );
    res.json({ response });
  } catch (error) {
    next(error);
  }
});

// Simplified routes from previous setup that might be useful for basic testing
app.use("/api/campaigns", campaignRoutes); // Assumes campaignRoutes is minimal
app.use("/api/webhooks", webhookRoutes);   // Assumes webhookRoutes is minimal
app.use("/api/dashboard", dashboardRoutes); // Assumes dashboardRoutes provides basic stats

// --- WebSocket Server ---
const wss = new WebSocketServer({ server, path: "/ws/chat" });

wss.on("connection", (ws: WebSocket) => {
  logger.info("WebSocket client connected");

  ws.on("message", async (messageBuffer: Buffer) => {
    try {
      const messageString = messageBuffer.toString();
      const parsedMessage = JSON.parse(messageString);

      if (parsedMessage.type === "chat" && parsedMessage.content && parsedMessage.sessionId) {
        const response = await simpleCathyAgent.generateResponse(parsedMessage.content, parsedMessage.sessionId);
        await storageService.createActivity(
          "ws_chat_message",
          `WS Chat - User: "${parsedMessage.content.substring(0,50)}..."`,
          "ws-chat-agent",
          { sessionId: parsedMessage.sessionId, responseLength: response.length }
        );
        ws.send(JSON.stringify({ type: "chat", sender: "agent", content: response, timestamp: new Date().toISOString() }));
      } else {
        logger.warn({ receivedMessage: parsedMessage }, "Received malformed WebSocket message");
        ws.send(JSON.stringify({ type: "error", content: "Invalid message format" }));
      }
    } catch (error) {
      logger.error({ error }, "Error processing WebSocket message");
      ws.send(JSON.stringify({ type: "error", content: "Error processing message" }));
    }
  });

  ws.on("close", () => {
    logger.info("WebSocket client disconnected");
  });

  ws.on("error", (error: Error) => {
    logger.error({ error },"WebSocket error");
  });

  ws.send(JSON.stringify({ type: "system", content: "Connected to CCL Chat Agent", timestamp: new Date().toISOString() }));
});

// --- Basic Error Handling Middleware ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred",
  });
});

// --- Server Startup ---
async function startServer() {
  try {
    // Start background workers
    campaignSender.start();
    logger.info("Campaign sender worker started.");

    // Initialize other services if necessary (kept minimal for now)

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`✅ Server running on port ${PORT} in ${config.get().NODE_ENV} mode`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`WebSocket chat: ws://localhost:${PORT}/ws/chat`);
      const mailgunStatus = mailgunService.getStatus();
      logger.info(`Mailgun configured: ${mailgunStatus.configured} (Domain: ${mailgunStatus.domain || 'N/A'})`);
      logger.info(`OpenRouter configured: ${!!config.get().OPENROUTER_API_KEY}`);
    });
  } catch (error) {
    logger.fatal({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Graceful Shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  campaignSender.stop(); // Stop campaign worker

  wss.close(err => {
    if (err) {
      logger.error({ err }, "Error closing WebSocket server");
    } else {
      logger.info("WebSocket server closed.");
    }

    server.close(async () => {
      logger.info("HTTP server closed.");
      // Add any other cleanup here (e.g., database connection pool)
      // await pool.end(); // If using a global pool object
      logger.info("Exiting.");
      process.exit(0);
    });
  });

  // Force shutdown if graceful fails
  setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10000); // 10 seconds
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();

export { app, server }; // Export for potential testing
