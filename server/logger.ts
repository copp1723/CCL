import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from './config/environment';

// Production-ready structured logging with comprehensive PII protection
export const logger = pino({
  level: config.get().LOG_LEVEL,
  redact: {
    paths: [
      // Personal Information Protection
      '*.phoneNumber', '*.phone_number', '*.phone',
      '*.firstName', '*.first_name', '*.lastName', '*.last_name',
      '*.street', '*.address', '*.city', '*.zip', '*.zipCode',
      '*.email', '*.emailAddress', '*.emailHash', '*.email_hash',
      '*.ssn', '*.socialSecurity', '*.income', '*.annualIncome',
      '*.employer', '*.jobTitle', '*.creditScore',
      
      // Authentication & Security
      '*.password', '*.apiKey', '*.token', '*.secret',
      '*.authToken', '*.accessToken', '*.refreshToken',
      '*.jwt', '*.sessionId', '*.session_id',
      
      // Financial Information
      '*.creditCardNumber', '*.bankAccount', '*.routingNumber',
      '*.loanAmount', '*.monthlyPayment', '*.interestRate',
      
      // SFTP & External Service Credentials
      '*.sftpPassword', '*.vendorPassword', '*.vendorId',
      '*.twilioAuthToken', '*.sendgridApiKey',
      
      // Request/Response sensitive data
      'req.body.password', 'req.body.apiKey',
      'res.body.creditScore', 'res.body.phoneNumber',
      
      // Chat & Conversation Data (potentially contains PII)
      '*.messages[*].content', '*.chatHistory[*].message',
      '*.conversationData', '*.userInput', '*.agentResponse'
    ],
    censor: '***REDACTED***'
  },
  transport: config.isDevelopment() ? {
    target: 'pino-pretty',
    options: { 
      colorize: true, 
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{time} [{level}] {msg}'
    }
  } : undefined,
  base: {
    env: config.get().NODE_ENV,
    service: 'ccl-agent-system',
    version: '2.0.0'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  }
});

// Enhanced request logger building on existing middleware/logger.ts
export function enhancedRequestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  
  // Attach request ID to request for correlation
  (req as any).requestId = requestId;
  
  // Create API key fingerprint (safe logging of authentication)
  const apiKey = req.header('x-api-key') || 
                 req.header('authorization')?.replace('Bearer ', '') || '';
  const apiKeyFingerprint = apiKey
    ? crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 8)
    : 'none';

  // Log request start with context
  logger.info({
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    apiKeyFingerprint,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  }, 'HTTP request started');

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const responseSize = res.get('Content-Length');
    
    logger.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      responseSize: responseSize ? parseInt(responseSize) : undefined,
      apiKeyFingerprint
    }, 'HTTP request completed');
  });

  // Capture response error event
  res.on('error', (error) => {
    logger.error({
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: error.message,
      stack: error.stack
    }, 'HTTP request error');
  });

  next();
}

// Specialized loggers for different components
export const sftpLogger = logger.child({ component: 'sftp-ingestor' });
export const abandonmentLogger = logger.child({ component: 'abandonment-detector' });
export const outreachLogger = logger.child({ component: 'outreach-orchestrator' });
export const chatLogger = logger.child({ component: 'realtime-chat-agent' });
export const leadLogger = logger.child({ component: 'lead-packaging-agent' });
export const boberdooLogger = logger.child({ component: 'boberdoo-service' });

// Utility functions for safe logging
export function safeLogVisitor(visitor: any, message: string, additionalData?: any) {
  logger.info({
    visitorId: visitor.id,
    sessionId: visitor.sessionId,
    abandonmentStep: visitor.abandonmentStep,
    piiComplete: visitor.piiComplete,
    source: visitor.ingestSource,
    ...additionalData
  }, message);
}

export function safeLogLead(lead: any, message: string, additionalData?: any) {
  logger.info({
    leadId: lead.id,
    leadPackageId: lead.leadId,
    status: lead.status,
    source: lead.source,
    visitorId: lead.visitorId,
    ...additionalData
  }, message);
}

export function safeLogChatSession(session: any, message: string, additionalData?: any) {
  chatLogger.info({
    sessionId: session.sessionId,
    visitorId: session.visitorId,
    isActive: session.isActive,
    messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    agentType: session.agentType,
    ...additionalData
  }, message);
}

// Error logging with context preservation
export function logError(error: Error, context: any = {}, message?: string) {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context,
    timestamp: new Date().toISOString()
  }, message || 'Application error occurred');
}

// Performance and metrics logging
export function logPerformance(operation: string, duration: number, additionalMetrics?: any) {
  logger.info({
    operation,
    duration,
    ...additionalMetrics,
    type: 'performance'
  }, `Performance: ${operation} completed in ${duration}ms`);
}

// Business event logging for analytics
export function logBusinessEvent(event: string, data: any = {}) {
  logger.info({
    event,
    ...data,
    type: 'business_event',
    timestamp: new Date().toISOString()
  }, `Business Event: ${event}`);
}

export default logger;
