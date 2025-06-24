import express, { Express, Request, Response, NextFunction } from "express";
import { createServer, Server as HttpServer } from "http";
import { WebSocketServer } from "ws"; // WebSocket type might be needed by configureWebSockets
import cors from "cors";
import { logger } from "./logger";
import config from "./config/environment";
import { globalErrorHandler } from "./utils/errorHandler"; // Import the new error handler

export interface AppConfig {
  appName: string;
  isProduction: boolean;
  corsOrigin: string | string[] | undefined;
  port: number;
  configureRoutes: (app: Express) => void;
  configureWebSockets: (wss: WebSocketServer) => void;
  onServerStart?: () => Promise<void> | void; // For things like campaignSender.start()
  onShutdown?: () => Promise<void> | void; // For things like campaignSender.stop()
}

export function createApp(appConfig: AppConfig): {
  app: Express;
  server: HttpServer;
  wss: WebSocketServer;
} {
  const app = express();
  const server: HttpServer = createServer(app);

  // --- Core Middleware ---
  app.use(
    cors({
      origin: appConfig.corsOrigin || config.get().CORS_ORIGIN || "*",
      credentials: true,
    })
  );
  app.use(express.json({ limit: appConfig.isProduction ? "10mb" : "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: appConfig.isProduction ? "10mb" : "1mb" }));

  // Simple request logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.url} - [${appConfig.appName}]`);
    next();
  });

  // --- API Routes (delegated) ---
  appConfig.configureRoutes(app);

  // --- WebSocket Server ---
  const wss = new WebSocketServer({ server, path: "/ws/chat" });
  logger.info(`WebSocket server configured at /ws/chat - [${appConfig.appName}]`);
  appConfig.configureWebSockets(wss);

  // --- Global Error Handling Middleware ---
  // This should be placed after all other app.use() and routes calls
  app.use(globalErrorHandler);

  // --- Server Startup ---
  async function start() {
    try {
      if (appConfig.onServerStart) {
        await appConfig.onServerStart();
      }

      server.listen(appConfig.port, "0.0.0.0", () => {
        logger.info(
          `✅ Server [${appConfig.appName}] running on port ${appConfig.port} in ${config.get().NODE_ENV} mode`
        );
        logger.info(`Health check (if configured): http://localhost:${appConfig.port}/health`);
        logger.info(`WebSocket chat: ws://localhost:${appConfig.port}/ws/chat`);
      });
    } catch (error) {
      logger.fatal({ error, appName: appConfig.appName }, "Failed to start server");
      process.exit(1);
    }
  }

  start();

  // --- Graceful Shutdown ---
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down [${appConfig.appName}] gracefully...`);

    if (appConfig.onShutdown) {
      await appConfig.onShutdown();
    }

    wss.close(err => {
      if (err) {
        logger.error({ err, appName: appConfig.appName }, "Error closing WebSocket server");
      } else {
        logger.info(`WebSocket server closed. - [${appConfig.appName}]`);
      }

      server.close(async () => {
        logger.info(`HTTP server closed. - [${appConfig.appName}]`);
        logger.info(`Exiting [${appConfig.appName}].`);
        process.exit(0);
      });
    });

    // Force shutdown if graceful fails
    setTimeout(() => {
      logger.error({ appName: appConfig.appName }, "Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10000); // 10 seconds
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions and unhandled rejections for this app instance
  // This might be better handled globally if only one server runs per process.
  // If multiple `createApp` instances run in one process, this could lead to issues.
  // For now, assuming one main server instance.
  process.on("uncaughtException", error => {
    logger.error({ error, appName: appConfig.appName }, "Uncaught Exception in app instance");
    if (appConfig.isProduction) {
      logger.info("Continuing operation in production mode (app instance)...");
    } else {
      // process.exit(1); // This might be too aggressive if other apps are running
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error(
      { reason, promise, appName: appConfig.appName },
      "Unhandled Rejection in app instance"
    );
    if (appConfig.isProduction) {
      logger.info("Continuing operation in production mode (app instance)...");
    }
  });

  return { app, server, wss };
}
