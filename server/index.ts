import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import cors from "cors";
import { storage } from "./database-storage.js";
import { storageService } from "./services/storage-service.js";
import { requestLogger } from "./middleware/logger.js";
import { apiRateLimiter } from "./middleware/rate-limit.js";
import { setupVite, serveStatic } from "./vite.js";
import { campaignSender } from "./workers/campaign-sender.js";
import campaignRoutes from "./routes/campaigns.js";
import webhookRoutes from "./routes/webhooks.js";
import promptTestingRoutes from "./routes/prompt-testing.js";
import { mailgunService } from "./services/mailgun-service.js";

// Import MVP Automation Services
import { enhancedRequestLogger, logger } from "./logger.js";
import config from "./config/environment.js";
import { sftpIngestor } from "./services/sftp-ingestor.js";
import { abandonmentDetector } from "./jobs/abandonment-detector.js";
import { outreachOrchestrator } from "./jobs/outreach-orchestrator.js";
import { twilioSms } from "./services/twilio-sms.js";
import { boberdooService } from "./services/boberdoo-service.js";
import twilioWebhookRoutes from "./routes/twilio-webhooks.js";
import dashboardRoutes from "./routes/dashboard.js";

// Initialize configuration and logging
logger.info("Starting CCL Agent System with MVP Automation Pipeline");

// Start background workers
campaignSender.start();

// Initialize MVP automation services
async function initializeMvpServices() {
  try {
    logger.info("Initializing MVP automation services...");

    // Initialize SFTP ingestion service
    await sftpIngestor.initialize();

    // Initialize abandonment detection service
    await abandonmentDetector.initialize();

    // Start services if configured
    const sftpConfig = config.getSftpConfig();
    if (sftpConfig.configured) {
      await sftpIngestor.start();
      logger.info("SFTP ingestion service started");
    } else {
      logger.warn("SFTP not configured - ingestion service not started");
    }

    await abandonmentDetector.start();
    logger.info("Abandonment detection service started");

    logger.info("MVP automation services initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize MVP automation services");
    // Don't exit - continue with basic functionality
  }
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// API Key validation middleware
const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  const validApiKey = process.env.CCL_API_KEY || process.env.API_KEY;

  if (!validApiKey) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid API key required",
    });
  }
  next();
};

// =============================================================================
// MVP AUTOMATION PIPELINE API ENDPOINTS
// =============================================================================

// Manual SFTP ingestion trigger (protected)
app.post("/api/mvp/sftp/ingest", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    logger.info("Manual SFTP ingestion triggered via API");
    const result = await sftpIngestor.ingestDailyFiles();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Manual SFTP ingestion failed");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "SFTP ingestion failed",
    });
  }
});

// Manual abandonment detection trigger (protected)
app.post("/api/mvp/abandonment/detect", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    logger.info("Manual abandonment detection triggered via API");
    const result = await abandonmentDetector.detectAbandonedNow();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Manual abandonment detection failed");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Abandonment detection failed",
    });
  }
});

// Manual outreach campaign trigger (protected)
app.post("/api/mvp/outreach/process", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    logger.info("Manual outreach campaign triggered via API");
    const result = await outreachOrchestrator.processOutreachNow();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, "Manual outreach campaign failed");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Outreach campaign failed",
    });
  }
});

// Send specific outreach to a visitor (protected)
app.post("/api/mvp/outreach/visitor/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const visitorId = parseInt(req.params.id);
    const { channel = "sms" } = req.body;

    if (isNaN(visitorId)) {
      return res.status(400).json({ success: false, error: "Invalid visitor ID" });
    }

    logger.info({ visitorId, channel }, "Manual outreach to specific visitor triggered via API");
    const result = await outreachOrchestrator.sendSpecificOutreach(visitorId, channel);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error, visitorId: req.params.id }, "Manual specific outreach failed");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Specific outreach failed",
    });
  }
});

// Get outreach statistics
app.get("/api/mvp/outreach/stats", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const stats = await outreachOrchestrator.getOutreachStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get outreach stats");
    res.status(500).json({ success: false, error: "Failed to fetch outreach stats" });
  }
});

// Get conversion funnel data
app.get("/api/mvp/analytics/funnel", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const funnelData = await storage.getConversionFunnelData();
    res.json({ success: true, data: funnelData });
  } catch (error) {
    logger.error({ error }, "Failed to get conversion funnel data");
    res.status(500).json({ success: false, error: "Failed to fetch funnel data" });
  }
});

// Get lead metrics
app.get("/api/mvp/analytics/metrics", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await storage.getLeadMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error({ error }, "Failed to get lead metrics");
    res.status(500).json({ success: false, error: "Failed to fetch metrics" });
  }
});

// Get abandonment statistics
app.get("/api/mvp/abandonment/stats", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const stats = await abandonmentDetector.getAbandonmentStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, "Failed to get abandonment stats");
    res.status(500).json({ success: false, error: "Failed to fetch abandonment stats" });
  }
});

// Get visitor by ID (for debugging)
app.get("/api/mvp/visitors/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const visitorId = parseInt(req.params.id);
    if (isNaN(visitorId)) {
      return res.status(400).json({ success: false, error: "Invalid visitor ID" });
    }

    const visitor = await storage.getVisitor(visitorId);
    if (!visitor) {
      return res.status(404).json({ success: false, error: "Visitor not found" });
    }

    // Get related data
    const outreachAttempts = await storage.getOutreachAttemptsByVisitor(visitorId);
    const chatSessions = await storage.getChatSessionsByVisitor(visitorId);

    res.json({
      success: true,
      data: {
        visitor,
        outreachAttempts,
        chatSessions,
      },
    });
  } catch (error) {
    logger.error({ error, visitorId: req.params.id }, "Failed to get visitor details");
    res.status(500).json({ success: false, error: "Failed to fetch visitor" });
  }
});

// Update visitor PII (for manual data entry)
app.put("/api/mvp/visitors/:id/pii", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const visitorId = parseInt(req.params.id);
    if (isNaN(visitorId)) {
      return res.status(400).json({ success: false, error: "Invalid visitor ID" });
    }

    await storage.updateVisitorPii(visitorId, req.body);
    res.json({ success: true, message: "PII updated successfully" });
  } catch (error) {
    logger.error({ error, visitorId: req.params.id }, "Failed to update visitor PII");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update PII",
    });
  }
});

// Middleware - Order matters!
app.use(
  express.json({
    limit: "10mb",
    verify: (req: Request, res, buf) => {
      if (buf.length > 10 * 1024 * 1024) {
        throw new Error("Request too large");
      }
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 100,
  })
);

// Add our new security middleware first
app.use(enhancedRequestLogger); // Use enhanced logger instead of basic one
app.use(apiRateLimiter);

// Add the campaign, webhook, dashboard, and prompt-testing routers
app.use("/api/campaigns", campaignRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/webhooks", twilioWebhookRoutes); // Add Twilio webhook routes
app.use("/api/dashboard", dashboardRoutes); // Add dashboard API routes
app.use("/api/test", promptTestingRoutes);

// CORS configuration
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Input sanitization middleware
const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
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
    /delete\s+from/gi,
  ];

  const sanitize = (obj: unknown): unknown => {
    if (typeof obj === "string") {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(obj)) {
          return res.status(400).json({
            error: "Invalid input detected",
            code: "SECURITY_VIOLATION",
          });
        }
      }
      return obj.trim();
    } else if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        (obj as { [key: string]: unknown })[key] = sanitize(
          (obj as { [key: string]: unknown })[key]
        );
      }
    }
    return obj;
  };

  if (req.body) {
    try {
      req.body = sanitize(req.body);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid request data",
        code: "SANITIZATION_ERROR",
      });
    }
  }

  if (req.query) {
    try {
      req.query = sanitize(req.query) as { [key: string]: string };
    } catch (error) {
      return res.status(400).json({
        error: "Invalid query parameters",
        code: "SANITIZATION_ERROR",
      });
    }
  }

  next();
};

app.use(sanitizeInput);

// Health check
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Check health of MVP automation services
    const healthChecks = {
      server: { healthy: true },
      database: await storage.healthCheck(),
      sftp: await sftpIngestor.healthCheck(),
      abandonmentDetector: await abandonmentDetector.healthCheck(),
      outreachOrchestrator: await outreachOrchestrator.healthCheck(),
      twilioSms: await twilioSms.healthCheck(),
      boberdoo: await boberdooService.healthCheck(),
    };

    const allHealthy = Object.values(healthChecks).every(check => check.healthy);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      mailgun: mailgunService.getStatus(),
      services: healthChecks,
      mvpAutomation: {
        sftpConfigured: config.getSftpConfig().configured,
        messagingConfigured:
          config.getMessagingConfig().twilio.configured ||
          config.getMessagingConfig().sendgrid.configured,
        boberdooConfigured: config.getBoberdooConfig().configured,
      },
    });
  } catch (error) {
    logger.error({ error }, "Health check failed");
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// System stats endpoint (protected)
app.get("/api/system/stats", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    // Use the improved storageService for stats
    const stats = await storageService.getStats();

    // Add MVP automation metrics
    const leadMetrics = await storage.getLeadMetrics();
    const conversionFunnel = await storage.getConversionFunnelData();
    const abandonmentStats = await abandonmentDetector.getAbandonmentStats();

    res.json({
      success: true,
      data: {
        ...stats,
        mvpAutomation: {
          leadMetrics,
          conversionFunnel,
          abandonmentStats,
          services: {
            sftp: {
              configured: config.getSftpConfig().configured,
              running: !abandonmentDetector.isCurrentlyRunning(), // Simplified check
            },
            abandonmentDetector: {
              running: abandonmentDetector.isCurrentlyRunning(),
              nextRun: abandonmentDetector.getNextRunTime(),
            },
          },
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch system stats");
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// Leads endpoints - Using improved storageService
app.get("/api/leads", async (req: Request, res: Response) => {
  try {
    const leads = await storageService.getLeads();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch leads" });
  }
});

app.post("/api/leads", async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber, status = "new", leadData } = req.body;
    const lead = await storageService.createLead({ email, phoneNumber, status, leadData });
    res.json({ success: true, data: lead });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ success: false, error: (error as Error).message || "Failed to create lead" });
  }
});

// Activities endpoint - Using improved storageService
app.get("/api/activities", async (req: Request, res: Response) => {
  try {
    const activities = await storageService.getActivities(20);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch activities" });
  }
});

// Agents endpoint
app.get("/api/agents", async (req: Request, res: Response) => {
  try {
    const agents = await storage.getAgents();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch agents" });
  }
});

// Chat endpoint with OpenRouter integration
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    let response =
      "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";

    // Use OpenRouter instead of OpenAI
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
            "X-Title": "CCL Agent System",
          },
          body: JSON.stringify({
            model: "anthropic/claude-3.5-sonnet", // Using Claude 3.5 Sonnet via OpenRouter
            messages: [
              {
                role: "system",
                content:
                  "You are Cathy from Complete Car Loans. Keep responses under 50 words. Be warm but concise. Focus on: 1) Understanding their auto financing needs 2) Getting their phone number for soft credit check 3) Reassuring about credit acceptance. Avoid lengthy explanations. Use a conversational, helpful tone.",
              },
              { role: "user", content: message },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        if (openRouterResponse.ok) {
          const data = await openRouterResponse.json();
          response = data.choices[0]?.message?.content || response;
        } else {
          console.error("OpenRouter API error:", await openRouterResponse.text());
        }
      } catch (openRouterError) {
        console.error("OpenRouter API error:", openRouterError);
      }
    }

    await storageService.createActivity(
      "chat_message",
      `Chat interaction - User: "${message.substring(0, 30)}..." Response provided by Cathy`,
      "chat-agent",
      { messageLength: message.length, responseLength: response.length }
    );

    res.json({ response });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat service unavailable" });
  }
});

// CSV upload endpoint
app.post("/api/bulk-email/send", upload.single("csvFile"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No CSV file provided" });
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const lines = csvContent.split("\n").filter(line => line.trim());
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

    let processed = 0;
    const campaignId = `campaign_${Date.now()}`;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      if (values.length >= headers.length) {
        const leadData: { [key: string]: string } = {};
        headers.forEach((header, index) => {
          leadData[header] = values[index]?.trim();
        });

        if (leadData.email) {
          await storageService.createLead({
            email: leadData.email,
            phoneNumber: leadData.phone || leadData.phonenumber,
            status: "new",
            leadData,
          });
          processed++;
        }
      }
    }

    await storageService.createActivity(
      "csv_upload",
      `CSV upload completed - ${processed} leads processed`,
      "data-ingestion",
      { campaignId, processed, fileName: req.file.originalname }
    );

    res.json({
      success: true,
      data: { processed, campaignId },
      message: `Successfully processed ${processed} leads`,
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    res.status(500).json({ success: false, error: "Failed to process CSV file" });
  }
});

// Campaign endpoints
app.get("/api/bulk-email/campaigns", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: [
        {
          id: "demo_campaign_1",
          name: "Welcome Series",
          status: "active",
          totalRecipients: 150,
          emailsSent: 145,
          openRate: 0.35,
          clickRate: 0.12,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch campaigns" });
  }
});

app.get("/api/bulk-email/settings", async (req: Request, res: Response) => {
  try {
    const mailgunStatus = mailgunService.getStatus();
    res.json({
      success: true,
      data: {
        timing: {
          step1Delay: 24,
          step2Delay: 72,
          step3Delay: 168,
        },
        mailgun: {
          domain: mailgunStatus.domain,
          status: mailgunStatus.configured ? "connected" : "not_configured",
          configured: mailgunStatus.configured,
        },
        openrouter: {
          configured: !!process.env.OPENROUTER_API_KEY,
          status: process.env.OPENROUTER_API_KEY ? "connected" : "not_configured",
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch settings" });
  }
});

// Create HTTP server
const server = createServer(app);

// Simple WebSocket implementation with OpenRouter
const wss = new WebSocketServer({ server, path: "/ws/chat" });

wss.on("connection", (ws: WebSocket) => {
  console.log("[WebSocket] New connection established");

  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "chat") {
        let response =
          "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";

        // Use OpenRouter for WebSocket chat too
        if (process.env.OPENROUTER_API_KEY) {
          try {
            const openRouterResponse = await fetch(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
                  "X-Title": "CCL Agent System WebSocket",
                },
                body: JSON.stringify({
                  model: "anthropic/claude-3.5-sonnet",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are Cathy from Complete Car Loans. Keep responses under 50 words. Be warm, helpful, and focus on auto financing assistance.",
                    },
                    { role: "user", content: message.content },
                  ],
                  max_tokens: 150,
                  temperature: 0.7,
                }),
              }
            );

            if (openRouterResponse.ok) {
              const data = await openRouterResponse.json();
              response = data.choices[0]?.message?.content || response;
            }
          } catch (error) {
            console.error("OpenRouter WebSocket error:", error);
          }
        }

        await storageService.createActivity(
          "chat_message",
          `WebSocket chat - User: "${message.content.substring(0, 30)}..." Response provided by Cathy`,
          "realtime-chat",
          { messageLength: message.content.length, responseLength: response.length }
        );

        ws.send(
          JSON.stringify({
            type: "chat",
            message: response,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error("[WebSocket] Error processing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Sorry, I encountered an error processing your message.",
        })
      );
    }
  });

  ws.send(
    JSON.stringify({
      type: "system",
      message: "Connected to CCL Assistant",
    })
  );
});

// Setup Vite in development
if (process.env.NODE_ENV !== "production") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

const PORT = parseInt(process.env.PORT || "5000", 10);

// Initialize MVP services before starting server
initializeMvpServices()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(
        {
          port: PORT,
          environment: process.env.NODE_ENV,
          sftpConfigured: config.getSftpConfig().configured,
          messagingConfigured:
            config.getMessagingConfig().twilio.configured ||
            config.getMessagingConfig().sendgrid.configured,
          boberdooConfigured: config.getBoberdooConfig().configured,
        },
        "CCL Agent System with MVP Automation Pipeline started successfully"
      );

      console.log(`CCL Agent System running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`WebSocket available at ws://localhost:${PORT}/ws/chat`);
      console.log(`Mailgun configured: ${mailgunService.getStatus().configured}`);
      console.log(`OpenRouter configured: ${!!process.env.OPENROUTER_API_KEY}`);
      console.log(`MVP API endpoints available at /api/mvp/*`);
    });
  })
  .catch(error => {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");

  // Stop MVP automation services
  try {
    await sftpIngestor.stop();
    await abandonmentDetector.stop();
    await outreachOrchestrator.stop();
    logger.info("MVP automation services stopped");
  } catch (error) {
    logger.error({ error }, "Error stopping MVP automation services");
  }

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");

  // Stop MVP automation services
  try {
    await sftpIngestor.stop();
    await abandonmentDetector.stop();
    await outreachOrchestrator.stop();
    logger.info("MVP automation services stopped");
  } catch (error) {
    logger.error({ error }, "Error stopping MVP automation services");
  }

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
