import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import routes from './routes';
import { initializeWebSocket } from './websocket';
import { AgentOrchestrator } from './agents';
import { securityMiddleware } from './middleware/security';
import { errorHandler, ErrorLogger } from './utils/errorHandler';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

// Global unhandled promise rejection handler
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  ErrorLogger.logError(new Error(`Unhandled Rejection: ${reason}`), {
    operation: 'unhandledRejection',
    metadata: { reason: reason?.toString() }
  });
});

// Global uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  ErrorLogger.logError(error, {
    operation: 'uncaughtException'
  });
  // Give time for logs to flush before exiting
  setTimeout(() => process.exit(1), 1000);
});

// Middleware
app.use(cors());
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(securityMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    const logMessage = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;

    if (logLevel === 'error') {
      ErrorLogger.logWarning(logMessage, {
        operation: `${req.method} ${req.path}`,
        metadata: { statusCode: res.statusCode, duration, body: req.body }
      });
    } else {
      ErrorLogger.logInfo(logMessage);
    }

    return originalSend.call(this, data);
  };

  next();
});

let agentOrchestrator: AgentOrchestrator;

// Initialize services with error handling
async function initializeServices() {
  try {
    // Initialize WebSocket
    initializeWebSocket(io);
    ErrorLogger.logInfo('WebSocket initialized successfully');

    // Initialize Agent Orchestrator
    agentOrchestrator = new AgentOrchestrator();
    ErrorLogger.logInfo('Agent orchestrator initialized successfully');

  } catch (error) {
    ErrorLogger.logError(error as Error, { operation: 'service_initialization' });
    throw error;
  }
}

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  ErrorLogger.logInfo(`Received ${signal}, shutting down gracefully`);

  server.close(() => {
    ErrorLogger.logInfo('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    ErrorLogger.logWarning('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
initializeServices()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      ErrorLogger.logInfo(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  })
  .catch((error) => {
    ErrorLogger.logError(error as Error, { operation: 'server_startup' });
    process.exit(1);
  });