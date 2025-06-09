interface ErrorLog {
  message: string;
  stack?: string;
  timestamp: number;
  context?: string;
  count: number;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "critical";
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external?: number;
  };
  errorRate: number;
  lastError?: string;
  timestamp: string;
}

interface PerformanceReport {
  health: HealthStatus;
  topErrors: ErrorLog[];
  totalErrors: number;
}

class SystemMonitor {
  private errors: Map<string, ErrorLog> = new Map();
  private startTime = Date.now();
  private readonly MAX_ERRORS = 100;
  private readonly ERROR_RATE_WINDOW = 3600000; // 1 hour

  logError(error: Error, context?: string): void {
    const key = `${error.message}:${context || "unknown"}`;
    const existing = this.errors.get(key);

    if (existing) {
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      this.errors.set(key, {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        context,
        count: 1,
      });
    }

    // Keep only recent errors
    if (this.errors.size > this.MAX_ERRORS) {
      const oldestKey = Array.from(this.errors.keys())[0];
      this.errors.delete(oldestKey);
    }

    console.error(`[SystemMonitor] Error in ${context || "unknown"}:`, error.message);
  }

  getHealthStatus(): HealthStatus {
    const uptime = (Date.now() - this.startTime) / 1000;
    const memoryUsage = process.memoryUsage();
    const recentErrors = this.getRecentErrors();

    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (recentErrors.length > 10) status = "degraded";
    if (recentErrors.length > 50) status = "critical";

    return {
      status,
      uptime,
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      errorRate: this.calculateErrorRate(),
      lastError: recentErrors[0]?.message,
      timestamp: new Date().toISOString(),
    };
  }

  private getRecentErrors(): ErrorLog[] {
    const cutoff = Date.now() - this.ERROR_RATE_WINDOW;
    return Array.from(this.errors.values())
      .filter(error => error.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private calculateErrorRate(): number {
    const recentErrors = this.getRecentErrors();
    const totalOperations = Math.max(1, recentErrors.length + 100); // Estimate
    return Math.round((recentErrors.length / totalOperations) * 100);
  }

  getPerformanceReport(): PerformanceReport {
    const health = this.getHealthStatus();
    const topErrors = this.getRecentErrors()
      .slice(0, 10)
      .sort((a, b) => b.count - a.count);

    return {
      health,
      topErrors,
      totalErrors: this.errors.size,
    };
  }

  clearErrors(): void {
    this.errors.clear();
  }

  getErrorCount(): number {
    return this.getRecentErrors().length;
  }
}

export const systemMonitor = new SystemMonitor();
