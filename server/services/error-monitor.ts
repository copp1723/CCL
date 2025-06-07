import { storage } from '../database-storage';

interface ErrorMetric {
  errorType: string;
  count: number;
  lastOccurrence: Date;
  message: string;
  stack?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  errorRate: number;
  lastError?: string;
  timestamp: Date;
}

export class SystemMonitor {
  private errors = new Map<string, ErrorMetric>();
  private startTime = Date.now();
  private totalRequests = 0;
  private errorCount = 0;

  logError(error: Error, context?: string): void {
    const errorKey = `${error.name}_${context || 'general'}`;
    const existing = this.errors.get(errorKey);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      this.errors.set(errorKey, {
        errorType: error.name,
        count: 1,
        lastOccurrence: new Date(),
        message: error.message,
        stack: error.stack
      });
    }

    this.errorCount++;
    
    // Log critical errors to activity log
    if (error.name === 'DatabaseError' || error.name === 'OpenAIError') {
      storage.createActivity(
        'system_error',
        `Critical error in ${context || 'system'}: ${error.message}`,
        'SystemMonitor',
        {
          errorType: error.name,
          context,
          stack: error.stack?.substring(0, 500)
        }
      ).catch(console.error);
    }
  }

  logRequest(): void {
    this.totalRequests++;
  }

  getHealthStatus(): HealthStatus {
    const uptime = (Date.now() - this.startTime) / 1000;
    const memory = process.memoryUsage();
    const errorRate = this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (errorRate > 10) {
      status = 'critical';
    } else if (errorRate > 5 || memory.heapUsed > 200 * 1024 * 1024) {
      status = 'degraded';
    }

    const recentErrors = Array.from(this.errors.values())
      .filter(e => Date.now() - e.lastOccurrence.getTime() < 300000) // Last 5 minutes
      .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());

    return {
      status,
      uptime,
      memoryUsage: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024)
      },
      errorRate: Math.round(errorRate * 100) / 100,
      lastError: recentErrors[0]?.message,
      timestamp: new Date()
    };
  }

  getErrorMetrics(): ErrorMetric[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.count - a.count);
  }

  clearMetrics(): void {
    this.errors.clear();
    this.totalRequests = 0;
    this.errorCount = 0;
  }

  getPerformanceReport(): any {
    const health = this.getHealthStatus();
    const topErrors = this.getErrorMetrics().slice(0, 5);
    
    return {
      health,
      topErrors,
      metrics: {
        totalRequests: this.totalRequests,
        totalErrors: this.errorCount,
        errorTypes: this.errors.size,
        uptime: health.uptime
      }
    };
  }
}

export const systemMonitor = new SystemMonitor();