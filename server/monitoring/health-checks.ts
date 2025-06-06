import { db } from "../db";
import { storage } from "../database-storage";
import config from "../config/environment";

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

class HealthCheckService {
  private startTime = Date.now();

  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    
    // Database connectivity check
    checks.push(await this.checkDatabase());
    
    // Storage layer check
    checks.push(await this.checkStorage());
    
    // Email service check
    checks.push(await this.checkEmailService());
    
    // AI service check
    checks.push(await this.checkAIService());
    
    // Memory usage check
    checks.push(await this.checkMemoryUsage());
    
    // Disk space check (if applicable)
    checks.push(await this.checkDiskSpace());

    const summary = this.calculateSummary(checks);
    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || "1.0.0",
      environment: config.get().NODE_ENV,
      checks,
      summary
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Simple connectivity test
      await db.execute('SELECT 1');
      
      // Check for critical tables
      const result = await db.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('system_leads', 'system_activities', 'system_agents')
      `);
      
      const tableCount = result.rowCount || 0;
      const expectedTables = 3;
      
      return {
        name: 'database',
        status: tableCount === expectedTables ? 'healthy' : 'degraded',
        responseTime: Date.now() - start,
        details: {
          tablesFound: tableCount,
          expectedTables,
          connectionPool: 'active'
        }
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  private async checkStorage(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Test storage operations
      const stats = await storage.getStats();
      const agents = await storage.getAgents();
      
      return {
        name: 'storage',
        status: agents.length > 0 ? 'healthy' : 'degraded',
        responseTime: Date.now() - start,
        details: {
          agentCount: agents.length,
          leadCount: stats.leads,
          activityCount: stats.activities
        }
      };
    } catch (error) {
      return {
        name: 'storage',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Storage layer error'
      };
    }
  }

  private async checkEmailService(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const hasMailgunKey = !!config.get().MAILGUN_API_KEY;
      const hasMailgunDomain = !!config.get().MAILGUN_DOMAIN;
      
      const isConfigured = hasMailgunKey && hasMailgunDomain;
      
      return {
        name: 'email_service',
        status: isConfigured ? 'healthy' : 'degraded',
        responseTime: Date.now() - start,
        details: {
          mailgunConfigured: isConfigured,
          hasApiKey: hasMailgunKey,
          hasDomain: hasMailgunDomain
        }
      };
    } catch (error) {
      return {
        name: 'email_service',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Email service error'
      };
    }
  }

  private async checkAIService(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const hasOpenAIKey = !!config.get().OPENAI_API_KEY;
      
      return {
        name: 'ai_service',
        status: hasOpenAIKey ? 'healthy' : 'degraded',
        responseTime: Date.now() - start,
        details: {
          openaiConfigured: hasOpenAIKey,
          agentsEnabled: true
        }
      };
    } catch (error) {
      return {
        name: 'ai_service',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'AI service error'
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (usagePercent > 90) status = 'unhealthy';
      else if (usagePercent > 75) status = 'degraded';
      
      return {
        name: 'memory',
        status,
        responseTime: Date.now() - start,
        details: {
          heapUsedMB,
          heapTotalMB,
          usagePercent: Math.round(usagePercent),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        }
      };
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Memory check error'
      };
    }
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // For containers/cloud environments, this is often not applicable
      // but we can check if we're running out of temp space
      const tmpUsage = process.env.TMPDIR || '/tmp';
      
      return {
        name: 'disk_space',
        status: 'healthy',
        responseTime: Date.now() - start,
        details: {
          tmpDir: tmpUsage,
          note: 'Container environment - managed externally'
        }
      };
    } catch (error) {
      return {
        name: 'disk_space',
        status: 'healthy', // Non-critical for container environments
        responseTime: Date.now() - start,
        details: { note: 'Disk check not applicable in container environment' }
      };
    }
  }

  private calculateSummary(checks: HealthCheck[]) {
    const total = checks.length;
    const healthy = checks.filter(c => c.status === 'healthy').length;
    const degraded = checks.filter(c => c.status === 'degraded').length;
    const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
    
    return { total, healthy, degraded, unhealthy };
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalChecks = ['database', 'storage'];
    const hasCriticalFailure = checks.some(
      check => criticalChecks.includes(check.name) && check.status === 'unhealthy'
    );
    
    if (hasCriticalFailure) return 'unhealthy';
    
    const hasAnyUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasAnyDegraded = checks.some(check => check.status === 'degraded');
    
    if (hasAnyUnhealthy || hasAnyDegraded) return 'degraded';
    
    return 'healthy';
  }

  async getReadinessCheck(): Promise<{ ready: boolean; details: any }> {
    const health = await this.performHealthCheck();
    const criticalServices = ['database', 'storage'];
    
    const criticalServicesHealthy = health.checks
      .filter(check => criticalServices.includes(check.name))
      .every(check => check.status === 'healthy');
    
    return {
      ready: criticalServicesHealthy,
      details: {
        overall: health.status,
        critical: criticalServicesHealthy,
        timestamp: health.timestamp
      }
    };
  }
}

export const healthCheckService = new HealthCheckService();