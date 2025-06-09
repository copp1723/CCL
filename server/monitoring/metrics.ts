import { storage } from "../storage";
import config from "../config/environment";

export interface SystemMetrics {
  timestamp: string;
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: {
      usage: number;
      loadAverage: number[];
    };
  };
  application: {
    requestCount: number;
    errorCount: number;
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
    activeConnections: number;
  };
  business: {
    leads: {
      total: number;
      new: number;
      processed: number;
      converted: number;
    };
    agents: {
      active: number;
      processing: number;
      errors: number;
    };
    campaigns: {
      sent: number;
      delivered: number;
      bounced: number;
      clicked: number;
    };
  };
}

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  userAgent?: string;
  ipAddress?: string;
}

class MetricsCollector {
  private requestMetrics: PerformanceMetrics[] = [];
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];

  recordRequest(metrics: PerformanceMetrics) {
    this.requestMetrics.push(metrics);
    this.requestCount++;
    this.responseTimes.push(metrics.responseTime);

    if (metrics.statusCode >= 400) {
      this.errorCount++;
    }

    // Keep only last 1000 requests to prevent memory leaks
    if (this.requestMetrics.length > 1000) {
      this.requestMetrics = this.requestMetrics.slice(-1000);
    }

    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const loadAvg = process.platform !== "win32" ? require("os").loadavg() : [0, 0, 0];

    // Business metrics from storage
    const stats = await storage.getStats();
    const agents = await storage.getAgents();

    // Calculate response time percentiles
    const sortedTimes = this.responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      timestamp: new Date().toISOString(),
      system: {
        uptime,
        memory: memUsage,
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
          loadAverage: loadAvg,
        },
      },
      application: {
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        responseTime: {
          average:
            this.responseTimes.length > 0
              ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
              : 0,
          p95: sortedTimes[p95Index] || 0,
          p99: sortedTimes[p99Index] || 0,
        },
        activeConnections: this.requestMetrics.filter(m => Date.now() - m.timestamp < 5000).length,
      },
      business: {
        leads: {
          total: stats.leads,
          new: 0, // Would need to be calculated from database
          processed: 0,
          converted: 0,
        },
        agents: {
          active: agents.filter(a => a.status === "active").length,
          processing: agents.filter(a => a.processedToday > 0).length,
          errors: agents.filter(a => a.status === "error").length,
        },
        campaigns: {
          sent: 0, // Would need email campaign tracking
          delivered: 0,
          bounced: 0,
          clicked: 0,
        },
      },
    };
  }

  getRecentRequests(limit: number = 100): PerformanceMetrics[] {
    return this.requestMetrics.slice(-limit).sort((a, b) => b.timestamp - a.timestamp);
  }

  getErrorRate(timeWindowMs: number = 300000): number {
    // 5 minutes default
    const cutoff = Date.now() - timeWindowMs;
    const recentRequests = this.requestMetrics.filter(m => m.timestamp > cutoff);
    const recentErrors = recentRequests.filter(m => m.statusCode >= 400);

    return recentRequests.length > 0 ? (recentErrors.length / recentRequests.length) * 100 : 0;
  }

  getAverageResponseTime(timeWindowMs: number = 300000): number {
    const cutoff = Date.now() - timeWindowMs;
    const recentTimes = this.requestMetrics
      .filter(m => m.timestamp > cutoff)
      .map(m => m.responseTime);

    return recentTimes.length > 0 ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length : 0;
  }

  reset() {
    this.requestMetrics = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }

  // Export metrics in Prometheus format for external monitoring
  getPrometheusMetrics(): string {
    const metrics: string[] = [];

    metrics.push(`# HELP ccl_requests_total Total number of HTTP requests`);
    metrics.push(`# TYPE ccl_requests_total counter`);
    metrics.push(`ccl_requests_total ${this.requestCount}`);

    metrics.push(`# HELP ccl_errors_total Total number of HTTP errors`);
    metrics.push(`# TYPE ccl_errors_total counter`);
    metrics.push(`ccl_errors_total ${this.errorCount}`);

    metrics.push(`# HELP ccl_response_time_avg Average response time in milliseconds`);
    metrics.push(`# TYPE ccl_response_time_avg gauge`);
    metrics.push(`ccl_response_time_avg ${this.getAverageResponseTime()}`);

    metrics.push(`# HELP ccl_error_rate Error rate percentage`);
    metrics.push(`# TYPE ccl_error_rate gauge`);
    metrics.push(`ccl_error_rate ${this.getErrorRate()}`);

    const memUsage = process.memoryUsage();
    metrics.push(`# HELP ccl_memory_heap_used Heap memory used in bytes`);
    metrics.push(`# TYPE ccl_memory_heap_used gauge`);
    metrics.push(`ccl_memory_heap_used ${memUsage.heapUsed}`);

    return metrics.join("\n") + "\n";
  }
}

export const metricsCollector = new MetricsCollector();

// Middleware function to collect request metrics
export function requestMetricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on("finish", () => {
      const responseTime = Date.now() - start;

      metricsCollector.recordRequest({
        endpoint: req.path,
        method: req.method,
        responseTime,
        statusCode: res.statusCode,
        timestamp: Date.now(),
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip || req.connection.remoteAddress,
      });
    });

    next();
  };
}
