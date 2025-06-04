import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-simplified";
import { setupVite, serveStatic } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Register routes
registerRoutes(app);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("📧 Mailgun email system ready");
  console.log("🔄 Three data ingestion APIs active:");
  console.log("   1. POST /api/email-campaigns/bulk-send (Bulk Dataset)");
  console.log("   2. POST /api/leads/process (Real-time Processing)");
  console.log("   3. POST /api/webhook/dealer-leads (Dealer Webhook)");
});

function shutdown() {
  console.log("Received termination signal. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed. Exiting process.");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

if (process.env.NODE_ENV === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}