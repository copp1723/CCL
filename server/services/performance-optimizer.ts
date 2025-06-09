interface QueryMetrics {
  count: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  recentMs: number[];
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface PerformanceMetrics {
  queryPerformance: Record<string, QueryMetrics>;
  cache: {
    size: number;
    keys: string[];
  };
}

class DatabaseOptimizer {
  private queryMetrics: Map<string, QueryMetrics> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_RECENT_TIMES = 10;

  trackQuery(operation: string, durationMs: number): void {
    const existing = this.queryMetrics.get(operation) || {
      count: 0,
      avgMs: 0,
      maxMs: 0,
      minMs: Infinity,
      recentMs: [],
    };

    existing.count++;
    existing.maxMs = Math.max(existing.maxMs, durationMs);
    existing.minMs = Math.min(existing.minMs, durationMs);
    existing.recentMs.push(durationMs);

    if (existing.recentMs.length > this.MAX_RECENT_TIMES) {
      existing.recentMs.shift();
    }

    // Calculate average from recent times for better accuracy
    existing.avgMs = Math.round(
      existing.recentMs.reduce((sum, time) => sum + time, 0) / existing.recentMs.length
    );

    this.queryMetrics.set(operation, existing);
  }

  async withMetrics<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.trackQuery(operation, Date.now() - start);
      return result;
    } catch (error) {
      this.trackQuery(operation, Date.now() - start);
      throw error;
    }
  }

  getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  setCache(key: string, data: any, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs || this.CACHE_TTL,
    });
  }

  clearExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getPerformanceMetrics(): PerformanceMetrics {
    this.clearExpiredCache();

    const queryPerformance: Record<string, QueryMetrics> = {};
    const operations = Array.from(this.queryMetrics.keys());
    operations.forEach(operation => {
      const metrics = this.queryMetrics.get(operation);
      if (metrics) {
        queryPerformance[operation] = { ...metrics };
      }
    });

    return {
      queryPerformance,
      cache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys()),
      },
    };
  }

  resetMetrics(): void {
    this.queryMetrics.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }

  async createActivityOptimized(
    type: string,
    description: string,
    agentType?: string,
    metadata?: any
  ): Promise<any> {
    return this.withMetrics("createActivity", async () => {
      const { db } = await import("../db");
      const { systemActivities } = await import("../../shared/schema");

      const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const [activity] = await db
        .insert(systemActivities)
        .values({
          id: activityId,
          type,
          description,
          agentType,
          metadata,
          timestamp: new Date(),
        })
        .returning();

      return activity;
    });
  }

  async getStatsOptimized(): Promise<any> {
    return this.withMetrics("getStats", async () => {
      const { db } = await import("../db");
      const { systemLeads, systemActivities, systemAgents } = await import("../../shared/schema");

      const [leads, activities, agents] = await Promise.all([
        db.select().from(systemLeads),
        db.select().from(systemActivities),
        db.select().from(systemAgents),
      ]);

      return {
        leads: leads.length,
        activities: activities.length,
        agents: agents.length,
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
    });
  }
}

export const dbOptimizer = new DatabaseOptimizer();
