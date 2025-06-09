import express from "express";
import { healthCheckService } from "../monitoring/health-checks";
import { metricsCollector } from "../monitoring/metrics";
import config from "../config/environment";

const router = express.Router();

// Comprehensive health check endpoint
router.get("/health", async (req, res) => {
  try {
    const health = await healthCheckService.performHealthCheck();

    const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: "HEALTH_CHECK_FAILED",
        message: "Health check service unavailable",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Kubernetes/Docker readiness probe
router.get("/ready", async (req, res) => {
  try {
    const readiness = await healthCheckService.getReadinessCheck();

    if (readiness.ready) {
      res.status(200).json({
        success: true,
        message: "Service ready",
        details: readiness.details,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_NOT_READY",
          message: "Service not ready for traffic",
          category: "readiness",
          retryable: true,
        },
        details: readiness.details,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: "READINESS_CHECK_FAILED",
        message: "Readiness check failed",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Kubernetes/Docker liveness probe
router.get("/live", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Service alive",
    timestamp: new Date().toISOString(),
  });
});

// Application metrics endpoint
router.get("/metrics", async (req, res) => {
  try {
    const metrics = await metricsCollector.getSystemMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "METRICS_COLLECTION_FAILED",
        message: "Failed to collect system metrics",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Prometheus metrics export
router.get("/metrics/prometheus", (req, res) => {
  try {
    const prometheusMetrics = metricsCollector.getPrometheusMetrics();
    res.set("Content-Type", "text/plain");
    res.send(prometheusMetrics);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PROMETHEUS_EXPORT_FAILED",
        message: "Failed to export Prometheus metrics",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Performance metrics endpoint
router.get("/performance", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const recentRequests = metricsCollector.getRecentRequests(limit);
    const errorRate = metricsCollector.getErrorRate();
    const avgResponseTime = metricsCollector.getAverageResponseTime();

    res.json({
      success: true,
      data: {
        errorRate,
        averageResponseTime: avgResponseTime,
        recentRequests,
        summary: {
          totalRequests: recentRequests.length,
          averageResponseTime: Math.round(avgResponseTime),
          errorRate: Math.round(errorRate * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PERFORMANCE_METRICS_FAILED",
        message: "Failed to retrieve performance metrics",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Production readiness check
router.get("/production-readiness", (req, res) => {
  try {
    const readiness = config.validateProductionReadiness();
    const environment = config.get();

    res.json({
      success: true,
      data: {
        ready: readiness.ready,
        environment: environment.NODE_ENV,
        issues: readiness.issues,
        services: {
          database: !!environment.DATABASE_URL,
          email: !!(environment.MAILGUN_API_KEY && environment.MAILGUN_DOMAIN),
          ai: !!environment.OPENAI_API_KEY,
          authentication: !!environment.INTERNAL_API_KEY,
        },
        securityFeatures: {
          rateLimiting: true,
          inputSanitization: true,
          errorHandling: true,
          securityHeaders: true,
          requestLogging: true,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "READINESS_CHECK_FAILED",
        message: "Production readiness check failed",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Environment configuration (sanitized)
router.get("/config", (req, res) => {
  try {
    const environment = config.get();

    // Sanitized configuration without secrets
    const sanitizedConfig = {
      NODE_ENV: environment.NODE_ENV,
      PORT: environment.PORT,
      LOG_LEVEL: environment.LOG_LEVEL,
      METRICS_ENABLED: environment.METRICS_ENABLED,
      RATE_LIMIT_WINDOW_MS: environment.RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS: environment.RATE_LIMIT_MAX_REQUESTS,
      CORS_ORIGIN: environment.CORS_ORIGIN,
      DB_POOL_SIZE: environment.DB_POOL_SIZE,
      services: {
        database: !!environment.DATABASE_URL,
        email: !!(environment.MAILGUN_API_KEY && environment.MAILGUN_DOMAIN),
        ai: !!environment.OPENAI_API_KEY,
        flexpath: !!environment.FLEXPATH_API_KEY,
      },
    };

    res.json({
      success: true,
      data: sanitizedConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "CONFIG_RETRIEVAL_FAILED",
        message: "Failed to retrieve configuration",
        category: "monitoring",
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
