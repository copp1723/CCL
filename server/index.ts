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

registerRoutes(app).then((server) => {
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
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});