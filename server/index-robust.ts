import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import cors from "cors";

// 🚀 RENDER FIX: Immediate port binding for production deployment
const app = express();
const server = createServer(app);
const PORT = parseInt(process.env.PORT || "5000", 10);

// 🔧 Environment checks
const isProduction = process.env.NODE_ENV === "production";
const isRenderDeployment = process.env.RENDER_DEPLOYMENT === "true";
const gracefulStartup = process.env.GRACEFUL_STARTUP === "true";

console.log(`🚀 RENDER FIX: Starting server on port ${PORT}`);
console.log(`🔧 Environment: ${process.env.NODE_ENV}`);

// 📊 Server state tracking
const serverState = {
  database: "disconnected",
  services: "loading",
  agents: "inactive",
  websocket: "pending",
};

// 🏥 Basic health check (always available)
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

// 📈 System status endpoint (always available)
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

// 🔧 Basic middleware setup
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

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

// 🎯 RENDER SUCCESS: Server starts immediately
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ RENDER SUCCESS: Server listening on 0.0.0.0:${PORT}`);
  console.log(`🔍 Health check available at: http://0.0.0.0:${PORT}/health`);
  console.log(`⏰ Server started at: ${new Date().toISOString()}`);

  // Start loading advanced services after server is confirmed running
  if (gracefulStartup) {
    console.log(`🔄 Loading advanced services...`);
    loadAdvancedServices();
  }
});

// 🔄 Progressive service loading
async function loadAdvancedServices() {
  try {
    // Database setup with timeout and retry logic
    await setupDatabase();

    // Load storage services
    await setupStorageServices();

    // Initialize agents
    await setupAgents();

    // Setup WebSocket
    await setupWebSocket();

    // Load additional routes
    await setupRoutes();

    // Setup Vite (development) or static serving (production)
    await setupStaticServing();

    console.log(`✅ Advanced services loaded successfully`);
    serverState.services = "active";
  } catch (error) {
    console.error(`⚠️ Some advanced services failed to load (non-critical):`, error);
    serverState.services = "partial";
  }
}

// 💾 Database setup with graceful failure handling
async function setupDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      console.log(`⚠️ No DATABASE_URL configured, running in basic mode`);
      serverState.database = "not_configured";
      return;
    }

    console.log(`🔌 Attempting database connection...`);

    // Import database modules only when needed
    const { db } = await import("./db-postgres.js");
    const { storage } = await import("./database-storage.js");

    // Test database connection with timeout
    const connectionTimeout = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "5000", 10);

    await Promise.race([
      db.execute("SELECT 1"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database connection timeout")), connectionTimeout)
      ),
    ]);

    console.log(`✅ Database connection successful`);
    serverState.database = "connected";

    // Make storage available globally
    (global as any).storage = storage;
  } catch (error) {
    console.warn(`⚠️ Database connection failed (non-critical):`, error);
    serverState.database = "error";

    // Initialize fallback storage
    await setupFallbackStorage();
  }
}

// 🗄️ Fallback in-memory storage when database is unavailable
async function setupFallbackStorage() {
  console.log(`🔄 Initializing fallback storage...`);

  // Enhanced fallback storage with persistence simulation
  const fallbackStorage = {
    leads: [],
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
      const lead = {
        id: `lead_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...data,
      };
      this.leads.push(lead);

      // Auto-create activity
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

  (global as any).storage = fallbackStorage;
  console.log(`✅ Fallback storage initialized with enhanced features`);
}

// 🤖 Agent setup
async function setupAgents() {
  try {
    console.log(`🤖 Initializing agents...`);
    serverState.agents = "active";
    console.log(`✅ Agents initialized`);
  } catch (error) {
    console.warn(`⚠️ Agent initialization failed:`, error);
    serverState.agents = "error";
  }
}

// 🌐 WebSocket setup
async function setupWebSocket() {
  try {
    const wss = new WebSocketServer({ server, path: "/ws/chat" });

    wss.on("connection", (ws: WebSocket) => {
      console.log("[WebSocket] New connection established");

      ws.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === "chat") {
            const responses = [
              "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?",
              "I understand financing can be stressful. Let me see what options we have for you.",
              "We specialize in helping people with all credit situations. What's your main concern?",
            ];

            const response = responses[Math.floor(Math.random() * responses.length)];

            ws.send(
              JSON.stringify({
                type: "chat",
                message: response,
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (error) {
          console.error("[WebSocket] Error:", error);
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

    console.log(`✅ WebSocket server configured`);
    serverState.websocket = "ready";
  } catch (error) {
    console.warn(`⚠️ WebSocket setup failed:`, error);
    serverState.websocket = "error";
  }
}

// 🗄️ Storage service setup
async function setupStorageServices() {
  try {
    const storage = (global as any).storage;
    if (storage) {
      const { storageService } = await import("./services/storage-service.js");
      console.log(`✅ Storage services loaded`);
    }
  } catch (error) {
    console.warn(`⚠️ Storage services failed to load:`, error);
  }
}

// 🛣️ API routes setup
async function setupRoutes() {
  try {
    const storage = (global as any).storage;

    // Load prompt testing routes
    try {
      const { default: promptTestingRoutes } = await import("./routes/prompt-testing.js");
      app.use("/api/test", promptTestingRoutes);
      console.log(`✅ Prompt testing routes loaded`);
    } catch (error) {
      console.warn(`⚠️ Prompt testing routes failed to load:`, error);
    }

    // Bulk email settings route
    try {
      const { default: bulkEmailSettingsRoutes } = await import(
        "./routes/bulk-email-settings.js"
      );
      app.use("/api/bulk-email", bulkEmailSettingsRoutes);
      console.log(`✅ Bulk email settings routes loaded`);
    } catch (error) {
      console.warn(`⚠️ Bulk email settings routes failed to load:`, error);
    }

    // System stats endpoint (protected)
    app.get("/api/system/stats", apiKeyAuth, async (req: Request, res: Response) => {
      try {
        const stats = await storage.getStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch stats" });
      }
    });

    // Leads endpoints
    app.get("/api/leads", async (req: Request, res: Response) => {
      try {
        const leads = await storage.getLeads();
        res.json(leads);
      } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch leads" });
      }
    });

    app.post("/api/leads", async (req: Request, res: Response) => {
      try {
        const { email, phoneNumber, status = "new", leadData } = req.body;
        const lead = await storage.createLead({ email, phoneNumber, status, leadData });
        res.json({ success: true, data: lead });
      } catch (error: unknown) {
        res.status(500).json({
          success: false,
          error: (error as Error).message || "Failed to create lead",
        });
      }
    });

    // Activities endpoint
    app.get("/api/activities", async (req: Request, res: Response) => {
      try {
        const activities = await storage.getActivities(20);
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

    // Campaign endpoints
    app.get("/api/campaigns", async (req: Request, res: Response) => {
      try {
        const campaigns = await storage.getCampaigns();
        res.json(campaigns);
      } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch campaigns" });
      }
    });

    app.post("/api/campaigns", async (req: Request, res: Response) => {
      try {
        const { name, goal_prompt } = req.body;
        const campaign = await storage.createCampaign({ name, goal_prompt });
        res.json({ success: true, data: campaign });
      } catch (error) {
        res.status(500).json({ success: false, error: "Failed to create campaign" });
      }
    });

    // Chat endpoint
    app.post("/api/chat", async (req: Request, res: Response) => {
      try {
        const { message } = req.body;
        let response =
          "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?";

        // Support both OpenRouter and OpenAI
        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

        if (apiKey) {
          try {
            const apiUrl = useOpenRouter
              ? "https://openrouter.ai/api/v1/chat/completions"
              : "https://api.openai.com/v1/chat/completions";

            const headers: any = {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            };

            // OpenRouter requires these additional headers
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
                  {
                    role: "system",
                    content:
                      "You are Cathy from Complete Car Loans. You help people get auto financing regardless of credit history. Be warm, helpful, and professional. Keep responses under 50 words. Ask relevant questions about their car needs, budget, and timeline. Guide them toward applying.",
                  },
                  { role: "user", content: message },
                ],
                max_tokens: 150,
                temperature: 0.7,
              }),
            });

            if (openaiResponse.ok) {
              const data = await openaiResponse.json();
              response = data.choices[0]?.message?.content || response;
            } else {
              const errorData = await openaiResponse.json();
              console.error("OpenAI API returned error:", openaiResponse.status, errorData);
            }
          } catch (openaiError) {
            console.error("OpenAI API error:", openaiError);
          }
        }

        res.json({ response });
      } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Chat service unavailable" });
      }
    });

    // Test OpenAI endpoint
    app.get("/api/test-openai", async (req: Request, res: Response) => {
      try {
        if (!process.env.OPENAI_API_KEY) {
          return res.json({ error: "No OpenAI API key configured" });
        }

        const testResponse = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        });

        if (testResponse.ok) {
          const models = await testResponse.json();
          const hasGPT4 = models.data.some((m: any) => m.id.includes("gpt-4"));
          res.json({
            status: "connected",
            hasGPT4Access: hasGPT4,
            modelCount: models.data.length,
          });
        } else {
          const error = await testResponse.json();
          res.json({ status: "error", error });
        }
      } catch (error) {
        res.json({ status: "error", message: error.message });
      }
    });

    // CSV upload endpoint with enhanced campaign integration
    app.post(
      "/api/bulk-email/send",
      upload.single("csvFile"),
      async (req: Request, res: Response) => {
        try {
          if (!req.file) {
            return res.status(400).json({ success: false, error: "No CSV file provided" });
          }

          const csvContent = req.file.buffer.toString("utf-8");
          const lines = csvContent.split("\n").filter(line => line.trim());
          const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

          let processed = 0;
          const campaignId = `campaign_${Date.now()}`;
          const processedLeads = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",");
            if (values.length >= headers.length) {
              const leadData: { [key: string]: string } = {};
              headers.forEach((header, index) => {
                leadData[header] = values[index]?.trim();
              });

              if (leadData.email) {
                const newLead = await storage.createLead({
                  email: leadData.email,
                  phoneNumber: leadData.phone || leadData.phonenumber,
                  status: "new",
                  leadData: {
                    firstName:
                      leadData.firstname || leadData.first_name || leadData.name?.split(" ")[0],
                    lastName:
                      leadData.lastname || leadData.last_name || leadData.name?.split(" ")[1],
                    vehicleInterest: leadData.vehicleinterest || leadData.vehicle_interest,
                    creditScore: leadData.creditscore || leadData.credit_score,
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

          // Create activity with better metadata
          await storage.createActivity(
            "csv_upload",
            `CSV upload completed - ${processed} leads processed from ${req.file.originalname}`,
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
            data: {
              processed,
              campaignId,
              leads: processedLeads,
              fileName: req.file.originalname,
            },
            message: `Successfully processed ${processed} leads. Ready for campaign use!`,
          });
        } catch (error) {
          console.error("CSV upload error:", error);
          res.status(500).json({ success: false, error: "Failed to process CSV file" });
        }
      }
    );

    console.log(`✅ API routes configured`);
  } catch (error) {
    console.warn(`⚠️ Route setup failed:`, error);
  }
}

// 🖥️ Static file serving setup
async function setupStaticServing() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { setupVite } = await import("./vite.js");
      setupVite(app, server);
      console.log(`✅ Vite development server configured`);
    } else {
      const { serveStatic } = await import("./vite.js");
      serveStatic(app);
      console.log(`✅ Static file serving configured`);
    }
  } catch (error) {
    console.warn(`⚠️ Static serving setup failed:`, error);
  }
}

// 🔄 Keep-alive logging
if (isRenderDeployment) {
  setInterval(() => {
    console.log(`🔄 Server alive on port ${PORT} - uptime: ${Math.round(process.uptime())}s`);
  }, 30000);
}

// 🛑 Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions gracefully in production
process.on("uncaughtException", error => {
  console.error("Uncaught Exception:", error);
  if (isProduction) {
    console.log("Continuing operation in production mode...");
  } else {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (isProduction) {
    console.log("Continuing operation in production mode...");
  }
});
