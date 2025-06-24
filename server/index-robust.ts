import { Express, Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { createApp, AppConfig } from "./app"; // Import the new app creator
import { logger } from "./logger"; // Ensure logger is imported if used standalone

// 🔧 Environment checks
const isProduction = process.env.NODE_ENV === "production";
const isRenderDeployment = process.env.RENDER_DEPLOYMENT === "true"; // Keep this for Render-specific logic
const gracefulStartup = process.env.GRACEFUL_STARTUP === "true"; // If still needed for phased loading

const PORT = parseInt(process.env.PORT || "5000", 10);

// 📊 Server state tracking (can be managed within robust server logic or passed around)
const serverState = {
  database: "disconnected",
  services: "loading",
  agents: "inactive",
  websocket: "pending",
};

// Middleware and utility functions specific to robust server
const upload = multer({ storage: multer.memoryStorage() });

const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  const validApiKey = process.env.CCL_API_KEY || process.env.API_KEY;
  if (!validApiKey) return res.status(500).json({ error: "Server configuration error" });
  if (!apiKey || apiKey !== validApiKey)
    return res.status(401).json({ error: "Unauthorized", message: "Valid API key required" });
  next();
};

// --- Service Setup Functions (extracted from index-robust.ts) ---
async function setupDatabaseRobust() {
  try {
    if (!process.env.DATABASE_URL) {
      logger.warn(`⚠️ No DATABASE_URL configured, running in basic mode`);
      serverState.database = "not_configured";
      await setupFallbackStorageRobust(); // Ensure fallback is set if DB is not configured
      return;
    }
    logger.info(`🔌 Attempting database connection...`);
    const { db } = await import("./db-postgres.js"); // Dynamic import
    const { storage } = await import("./database-storage.js"); // Dynamic import
    const connectionTimeout = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "5000", 10);
    await Promise.race([
      db.execute("SELECT 1"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database connection timeout")), connectionTimeout)
      ),
    ]);
    logger.info(`✅ Database connection successful`);
    serverState.database = "connected";
    (global as any).storage = storage; // Make main storage available
  } catch (error) {
    logger.warn(`⚠️ Database connection failed (non-critical):`, {
      error: (error as Error).message,
    });
    serverState.database = "error";
    await setupFallbackStorageRobust();
  }
}

async function setupFallbackStorageRobust() {
  logger.info(`🔄 Initializing fallback storage...`);
  const fallbackStorage = {
    /* ... (same fallbackStorage object as before) ... */ leads: [],
    activities: [],
    campaigns: [
      {
        id: "demo_campaign_1",
        name: "Welcome Series",
        status: "active",
        totalRecipients: 150,
        emailsSent: 145,
        openRate: 0.35,
        clickRate: 0.12,
        createdAt: new Date().toISOString(),
        goal_prompt: "Get customers excited about their auto financing options",
      },
    ],
    agents: [
      {
        id: "agent_1",
        name: "VisitorIdentifierAgent",
        status: "active",
        processedToday: 0,
        description: "Detects abandoned applications",
        icon: "Users",
        color: "text-blue-600",
      },
      {
        id: "agent_2",
        name: "RealtimeChatAgent",
        status: "active",
        processedToday: 0,
        description: "Handles live customer chat",
        icon: "MessageCircle",
        color: "text-green-600",
      },
    ],
    async createLead(data: any) {
      const lead = { id: `lead_${Date.now()}`, createdAt: new Date().toISOString(), ...data };
      this.leads.push(lead);
      await this.createActivity("lead_created", `New lead added: ${data.email}`, "data-ingestion", {
        email: data.email,
        source: "csv_upload",
      });
      return lead;
    },
    async getLeads() {
      return this.leads;
    },
    async getActivities() {
      return this.activities;
    },
    async getAgents() {
      return this.agents;
    },
    async getCampaigns() {
      return this.campaigns;
    },
    async createCampaign(data: any) {
      const campaign = {
        id: `campaign_${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: "active",
        totalRecipients: 0,
        emailsSent: 0,
        openRate: 0,
        clickRate: 0,
        ...data,
      };
      this.campaigns.push(campaign);
      return campaign;
    },
    async createActivity(type: string, description: string, agentType?: string, metadata?: any) {
      const activity = {
        id: `activity_${Date.now()}`,
        type,
        description,
        agentType,
        metadata,
        timestamp: new Date().toISOString(),
      };
      this.activities.push(activity);
      return activity;
    },
    async getStats() {
      return {
        leads: this.leads.length,
        activities: this.activities.length,
        agents: this.agents.length,
        campaigns: this.campaigns.length,
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
    },
  };
  (global as any).storage = fallbackStorage; // Ensure fallback is globally available
  logger.info(`✅ Fallback storage initialized with enhanced features`);
}

async function setupAgentsRobust() {
  try {
    logger.info(`🤖 Initializing agents...`);
    // Actual agent initialization logic might go here if any
    serverState.agents = "active";
    logger.info(`✅ Agents initialized`);
  } catch (error) {
    logger.warn(`⚠️ Agent initialization failed:`, { error: (error as Error).message });
    serverState.agents = "error";
  }
}

async function setupStorageServicesRobust() {
  try {
    if ((global as any).storage) {
      // Check if storage (main or fallback) is initialized
      // const { storageService } = await import("./services/storage-service.js"); // If storageService is still separate
      logger.info(`✅ Storage services loaded/confirmed`);
    }
  } catch (error) {
    logger.warn(`⚠️ Storage services failed to load:`, { error: (error as Error).message });
  }
}

async function setupStaticServingRobust(app: Express) {
  try {
    if (isProduction) {
      const { serveStatic } = await import("./vite.js"); // Dynamic import
      serveStatic(app);
      logger.info(`✅ Static file serving configured`);
    } else {
      // Vite dev server setup is typically handled by the dev entry point (server/index.ts)
      logger.info("Static serving skipped in non-production or handled by dev server.");
    }
  } catch (error) {
    logger.warn(`⚠️ Static serving setup failed:`, { error: (error as Error).message });
  }
}

// --- Route Configuration for Robust Server ---
function configureRobustRoutes(app: Express) {
  // Basic health check (always available)
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      port: PORT,
      uptime: Math.round(process.uptime()),
      services: serverState,
    });
  });

  // System status endpoint
  app.get("/api/system/status", (req: Request, res: Response) => {
    res.json({
      status: "operational",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      port: PORT,
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      services: serverState,
    });
  });

  // Security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    if (isProduction)
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Dynamic imports for routes
  import("./routes/prompt-testing.js")
    .then(module => app.use("/api/test", module.default))
    .catch(e => logger.warn("Failed to load prompt-testing routes", e));
  import("./routes/bulk-email-settings.js")
    .then(module => app.use("/api/bulk-email", module.default))
    .catch(e => logger.warn("Failed to load bulk-email-settings routes", e));

  const storage = (global as any).storage; // Access storage, should be initialized by onServerStart

  // System stats endpoint (protected)
  app.get("/api/system/stats", apiKeyAuth, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch stats" });
    }
  });

  // Leads, Activities, Agents, Campaigns (simplified, assuming storage is ready)
  app.get("/api/leads", async (req, res) => {
    try {
      res.json(await storage.getLeads());
    } catch (e) {
      res.status(500).json({ e: (e as Error).message });
    }
  });
  app.post("/api/leads", async (req, res) => {
    try {
      const { email, phoneNumber, status = "new", leadData } = req.body;
      res.json({
        success: true,
        data: await storage.createLead({ email, phoneNumber, status, leadData }),
      });
    } catch (e) {
      res.status(500).json({ e: (e as Error).message });
    }
  });
  app.get("/api/activities", async (req, res) => {
    try {
      res.json(await storage.getActivities(20));
    } catch (e) {
      res.status(500).json({ e: (e as Error).message });
    }
  });
  app.get("/api/agents", async (req, res) => {
    try {
      res.json(await storage.getAgents());
    } catch (e) {
      res.status(500).json({ e: (e as Error).message });
    }
  });
  app.get("/api/campaigns", async (req, res) => {
    try {
      res.json(await storage.getCampaigns());
    } catch (e) {
      res.status(500).json({ e: (e as Error).message });
    }
  });
  app.post("/api/campaigns", async (req, res) => {
    try {
      const { name, goal_prompt } = req.body;
      res.json({ success: true, data: await storage.createCampaign({ name, goal_prompt }) });
    } catch (e) {
      res.status(500).json({ e: (e as Error).message });
    }
  });

  // Chat endpoint (OpenAI/OpenRouter specific logic)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      let responseText =
        "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
      const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
      if (apiKey) {
        const apiUrl = useOpenRouter
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
        const headers: any = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };
        if (useOpenRouter) {
          headers["HTTP-Referer"] = "https://ccl-agent-system.onrender.com";
          headers["X-Title"] = "CCL Agent System";
        }
        const openaiResponse = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: useOpenRouter ? "openai/gpt-4-turbo-preview" : "gpt-4-turbo-preview",
            messages: [
              { role: "system", content: "You are Cathy..." },
              { role: "user", content: message },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });
        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          responseText = data.choices[0]?.message?.content || responseText;
        } else {
          logger.error("OpenAI API error", {
            status: openaiResponse.status,
            data: await openaiResponse.text(),
          });
        }
      }
      res.json({ response: responseText });
    } catch (error) {
      logger.error("Chat error:", { e: (error as Error).message });
      res.status(500).json({ error: "Chat service unavailable" });
    }
  });

  // Test OpenAI
  app.get("/api/test-openai", async (req, res) => {
    /* ... same as before ... */
    try {
      if (!process.env.OPENAI_API_KEY) return res.json({ error: "No OpenAI API key configured" });
      const testResponse = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      if (testResponse.ok) {
        const models = await testResponse.json();
        const hasGPT4 = models.data.some((m: any) => m.id.includes("gpt-4"));
        res.json({ status: "connected", hasGPT4Access: hasGPT4, modelCount: models.data.length });
      } else {
        const error = await testResponse.json();
        res.json({ status: "error", error });
      }
    } catch (error) {
      res.json({ status: "error", message: (error as Error).message });
    }
  });

  // CSV Upload
  app.post("/api/bulk-email/send", upload.single("csvFile"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "No CSV file provided" });
      const csvContent = req.file.buffer.toString("utf-8");
      const lines = csvContent.split("\n").filter(line => line.trim());
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      let processed = 0;
      const campaignId = `campaign_${Date.now()}`;
      const processedLeads = [];
      for (let i = 1; i < lines.length; i++) {
        /* ... lead processing logic ... */
        const values = lines[i].split(",");
        if (values.length >= headers.length) {
          const leadDataCsv: { [key: string]: string } = {};
          headers.forEach((header, index) => {
            leadDataCsv[header] = values[index]?.trim();
          });
          if (leadDataCsv.email) {
            const newLead = await storage.createLead({
              email: leadDataCsv.email,
              phoneNumber: leadDataCsv.phone || leadDataCsv.phonenumber,
              status: "new",
              leadData: {
                firstName:
                  leadDataCsv.firstname ||
                  leadDataCsv.first_name ||
                  leadDataCsv.name?.split(" ")[0],
                lastName:
                  leadDataCsv.lastname || leadDataCsv.last_name || leadDataCsv.name?.split(" ")[1],
                vehicleInterest: leadDataCsv.vehicleinterest || leadDataCsv.vehicle_interest,
                creditScore: leadDataCsv.creditscore || leadDataCsv.credit_score,
                source: "csv_upload",
                uploadTimestamp: new Date().toISOString(),
                campaignId,
              },
            });
            processedLeads.push(newLead);
            processed++;
          }
        }
      }
      await storage.createActivity(
        "csv_upload",
        `CSV upload completed - ${processed} leads from ${req.file.originalname}`,
        "data-ingestion",
        {
          campaignId,
          processed,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          totalRows: lines.length - 1,
          successRate: ((processed / (lines.length - 1)) * 100).toFixed(1) + "%",
        }
      );
      res.json({
        success: true,
        data: { processed, campaignId, leads: processedLeads, fileName: req.file.originalname },
        message: `Successfully processed ${processed} leads.`,
      });
    } catch (error) {
      logger.error("CSV upload error:", { e: (error as Error).message });
      res.status(500).json({ success: false, error: "Failed to process CSV file" });
    }
  });
}

// --- WebSocket Configuration for Robust Server ---
function configureRobustWebSockets(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    logger.info("[WebSocket] New connection established (Robust Server)");
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "chat") {
          const responses = [
            "Hi! I'm Cathy...",
            "I understand financing can be stressful...",
            "We specialize in helping...",
          ];
          const response = responses[Math.floor(Math.random() * responses.length)];
          ws.send(
            JSON.stringify({ type: "chat", message: response, timestamp: new Date().toISOString() })
          );
        }
      } catch (error) {
        logger.error("[WebSocket] Error:", { e: (error as Error).message });
        ws.send(JSON.stringify({ type: "error", message: "Sorry, error processing message." }));
      }
    });
    ws.send(JSON.stringify({ type: "system", message: "Connected to CCL Assistant (Robust)" }));
  });
  serverState.websocket = "ready"; // Update server state
}

// --- Server Lifecycle Callbacks for Robust Server ---
async function onRobustServerStart(app: Express) {
  // Pass app for static serving setup
  logger.info(`🚀 RENDER FIX: Starting server on port ${PORT}`); // From original robust
  logger.info(`🔧 Environment: ${process.env.NODE_ENV}`); // From original robust

  if (gracefulStartup) {
    logger.info(`🔄 Loading advanced services...`);
    try {
      await setupDatabaseRobust();
      await setupStorageServicesRobust();
      await setupAgentsRobust();
      // WebSocket server is already configured by createApp, just update state or specific handlers if needed
      // Routes are configured by `configureRobustRoutes`
      await setupStaticServingRobust(app); // Pass app here
      logger.info(`✅ Advanced services loaded successfully`);
      serverState.services = "active";
    } catch (error) {
      logger.error(`⚠️ Some advanced services failed to load (non-critical):`, {
        e: (error as Error).message,
      });
      serverState.services = "partial";
    }
  } else {
    // If not graceful startup, ensure basic setup is done
    await setupDatabaseRobust(); // Still need storage, even if fallback
    await setupStaticServingRobust(app);
    serverState.services = "basic_active";
  }

  if (isRenderDeployment) {
    setInterval(() => {
      logger.info(
        `🔄 Server alive on port ${PORT} - uptime: ${Math.round(process.uptime())}s (Robust)`
      );
    }, 30000);
  }
}

// No specific shutdown for robust distinct from generic in app.ts, unless campaignSender or similar exists
// async function onRobustShutdown() { logger.info("Robust server specific shutdown actions."); }

// --- Create App Instance for Robust Server ---
const robustAppConfig: AppConfig = {
  appName: "CCL Agent System (Robust)",
  isProduction: true, // Explicitly true
  corsOrigin: process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"]
    : ["http://localhost:5173", "http://127.0.0.1:5173"],
  port: PORT,
  configureRoutes: configureRobustRoutes,
  configureWebSockets: configureRobustWebSockets,
  onServerStart: () => onRobustServerStart(robustApp.app), // Pass the app instance
  // onShutdown: onRobustShutdown, // If any specific shutdown needed
};

const robustApp = createApp(robustAppConfig);

// Global error handlers from index-robust.ts (these might be better in app.ts or handled carefully if multiple apps run)
// For now, they remain here, but their interaction with app.ts's handlers should be considered.
// process.on("uncaughtException", error => { /* ... */ });
// process.on("unhandledRejection", (reason, promise) => { /* ... */ });
// The app.ts already adds process level handlers. We should avoid duplicating them or ensure they coordinate.
// For now, relying on the ones in app.ts.
