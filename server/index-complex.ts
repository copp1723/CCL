
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import config from './config/environment';
import { dbManager } from './db';
import { securityMonitor, requestLogging, errorHandler } from './middleware/security-consolidated';
import { authMiddleware } from './middleware/auth';

// Route imports
import emailCampaignsRouter from './routes/email-campaigns';
import monitoringRouter from './routes/monitoring';
import promptTestingRouter from './routes/prompt-testing';
import dataIngestionRouter from './routes/data-ingestion-simple';

// Services
import { setupWebSocketServer } from './websocket';
import { startHealthChecks } from './monitoring/health-checks';

class ProductionServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer | null = null;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Rate limiting and security monitoring
    this.app.use(securityMonitor.ipBlockingMiddleware());
    this.app.use(securityMonitor.rateLimitMiddleware());
    this.app.use(securityMonitor.inputValidationMiddleware());
    this.app.use(securityMonitor.securityHeadersMiddleware());

    // Request logging
    this.app.use(requestLogging());

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS configuration
    const corsOrigin = config.get().CORS_ORIGIN;
    this.app.use(cors({
      origin: corsOrigin === '*' ? true : corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          environment: config.get().NODE_ENV
        }
      });
    });

    // Public routes (no auth required)
    this.app.use('/api/monitoring', monitoringRouter);
    this.app.use('/api/security', securityMonitoringRouter);

    // Protected routes (require auth)
    this.app.use('/api/email-campaigns', authMiddleware, emailCampaignsRouter);
    this.app.use('/api/prompt-testing', authMiddleware, promptTestingRouter);
    this.app.use('/api/data-ingestion', authMiddleware, dataIngestionRouter);

    // Static files in production
    if (config.isProduction()) {
      this.app.use(express.static('dist'));
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      });
    }

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          category: 'client',
          retryable: false
        }
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler());

    // Global error handlers
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Graceful shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  async start(): Promise<void> {
    try {
      // Initialize database
      await dbManager.connect();

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket server
      this.wss = setupWebSocketServer(this.server);

      // Start health monitoring
      startHealthChecks();

      const port = config.get().PORT;
      this.server.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📊 Environment: ${config.get().NODE_ENV}`);
        console.log(`🔒 Security monitoring: Active`);
        console.log(`💾 Database: ${dbManager.getDb() ? 'Connected' : 'In-memory'}`);
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
      }

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(resolve);
        });
      }

      // Close database connections
      await dbManager.close();

      console.log('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new ProductionServer();
server.start();
