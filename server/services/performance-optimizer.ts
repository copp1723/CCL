import { db } from '../db';
import { systemLeads, systemActivities, systemAgents } from '@shared/schema';
import { desc, eq, count, and, gte } from 'drizzle-orm';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class PerformanceCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 30000; // 30 seconds

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export class DatabaseOptimizer {
  private cache = new PerformanceCache();
  private queryTimes = new Map<string, number[]>();

  async getLeadsOptimized(limit: number = 50): Promise<any[]> {
    const cacheKey = `leads:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    
    // Optimized query with proper indexing and limited fields
    const leads = await db
      .select({
        id: systemLeads.id,
        email: systemLeads.email,
        status: systemLeads.status,
        leadData: systemLeads.leadData,
        createdAt: systemLeads.createdAt
      })
      .from(systemLeads)
      .orderBy(desc(systemLeads.createdAt))
      .limit(limit);

    const mapped = leads.map(lead => ({
      id: lead.id,
      email: lead.email,
      status: lead.status,
      leadData: lead.leadData,
      createdAt: lead.createdAt?.toISOString() || new Date().toISOString()
    }));

    this.recordQueryTime('getLeads', Date.now() - startTime);
    this.cache.set(cacheKey, mapped, 15000); // 15 second cache
    
    return mapped;
  }

  async getActivitiesOptimized(limit: number = 20): Promise<any[]> {
    const cacheKey = `activities:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    
    const activities = await db
      .select({
        id: systemActivities.id,
        type: systemActivities.type,
        description: systemActivities.description,
        agentType: systemActivities.agentType,
        metadata: systemActivities.metadata,
        timestamp: systemActivities.timestamp
      })
      .from(systemActivities)
      .orderBy(desc(systemActivities.timestamp))
      .limit(limit);

    const mapped = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      agentType: activity.agentType || undefined,
      metadata: activity.metadata,
      timestamp: activity.timestamp?.toISOString() || new Date().toISOString()
    }));

    this.recordQueryTime('getActivities', Date.now() - startTime);
    this.cache.set(cacheKey, mapped, 10000); // 10 second cache
    
    return mapped;
  }

  async getAgentsOptimized(): Promise<any[]> {
    const cacheKey = 'agents:all';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    
    const agents = await db
      .select()
      .from(systemAgents);

    const mapped = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      processedToday: agent.processedToday || 0,
      description: agent.description,
      icon: agent.icon,
      color: agent.color
    }));

    this.recordQueryTime('getAgents', Date.now() - startTime);
    this.cache.set(cacheKey, mapped, 60000); // 1 minute cache for agents
    
    return mapped;
  }

  async getStatsOptimized(): Promise<any> {
    const cacheKey = 'stats:system';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const startTime = Date.now();
    
    // Use parallel queries for better performance
    const [leadsCount, activitiesCount, agentsCount] = await Promise.all([
      db.select({ count: count() }).from(systemLeads),
      db.select({ count: count() }).from(systemActivities),
      db.select({ count: count() }).from(systemAgents)
    ]);

    const uptime = (Date.now() - process.uptime() * 1000) / 1000;
    const memory = process.memoryUsage();

    const stats = {
      leads: leadsCount[0]?.count || 0,
      activities: activitiesCount[0]?.count || 0,
      agents: agentsCount[0]?.count || 0,
      uptime,
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };

    this.recordQueryTime('getStats', Date.now() - startTime);
    this.cache.set(cacheKey, stats, 30000); // 30 second cache
    
    return stats;
  }

  async createActivityOptimized(
    type: string, 
    description: string, 
    agentType?: string, 
    metadata?: any
  ): Promise<any> {
    const startTime = Date.now();
    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(systemActivities).values({
      id: activityId,
      type,
      description,
      agentType,
      metadata
    });

    // Invalidate activity cache
    this.cache.invalidate('activities');
    this.cache.invalidate('stats');

    this.recordQueryTime('createActivity', Date.now() - startTime);
    
    return {
      id: activityId,
      type,
      description,
      agentType,
      metadata,
      timestamp: new Date().toISOString()
    };
  }

  private recordQueryTime(operation: string, time: number): void {
    if (!this.queryTimes.has(operation)) {
      this.queryTimes.set(operation, []);
    }
    
    const times = this.queryTimes.get(operation)!;
    times.push(time);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }

    // Log slow queries
    if (time > 1000) {
      console.warn(`Slow query detected: ${operation} took ${time}ms`);
    }
  }

  getPerformanceMetrics(): any {
    const metrics: any = {
      cache: this.cache.getStats(),
      queryPerformance: {}
    };

    for (const [operation, times] of this.queryTimes.entries()) {
      if (times.length > 0) {
        metrics.queryPerformance[operation] = {
          count: times.length,
          avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
          maxMs: Math.max(...times),
          minMs: Math.min(...times),
          recentMs: times.slice(-5) // Last 5 queries
        };
      }
    }

    return metrics;
  }

  invalidateCache(pattern?: string): void {
    if (pattern) {
      this.cache.invalidate(pattern);
    } else {
      this.cache.clear();
    }
  }
}

export const dbOptimizer = new DatabaseOptimizer();