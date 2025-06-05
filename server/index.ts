import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-simplified";
import { setupVite, serveStatic } from "./vite";
import { handleApiError } from "./utils/error-handler";
import { addEmailTestRoutes } from "./routes-email-test";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false }));

// Centralized error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  handleApiError(res, err);
});

// Register routes
registerRoutes(app);

// Add email testing routes
addEmailTestRoutes(app);

const PORT = parseInt(process.env.PORT || "5000", 10);
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