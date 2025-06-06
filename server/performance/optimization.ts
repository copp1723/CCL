import { Request, Response, NextFunction } from 'express';

// Performance optimization system for enterprise deployment

interface CacheEntry {
  data: any;
  timestamp: number;
  hitCount: number;
}

class PerformanceOptimizer {
  private responseCache = new Map<string, CacheEntry>();
  private cacheMaxSize = 1000;
  private cacheTTL = 300000; // 5 minutes

  private requestMetrics = {
    totalRequests: 0,
    slowRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    requestTimes: [] as number[]
  };

  // Smart caching middleware
  cacheMiddleware(ttlSeconds: number = 300) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = `${req.path}:${JSON.stringify(req.query)}`;
      const cached = this.responseCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        this.requestMetrics.cacheHits++;
        cached.hitCount++;
        
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000).toString()
        });
        
        return res.json(cached.data);
      }

      this.requestMetrics.cacheMisses++;
      res.set('X-Cache', 'MISS');

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        if (res.statusCode === 200) {
          // Clean old cache entries if needed
          if (this.responseCache.size >= this.cacheMaxSize) {
            const oldestKey = this.responseCache.keys().next().value;
            this.responseCache.delete(oldestKey);
          }

          this.responseCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            hitCount: 0
          });
        }
        return originalJson(data);
      };

      next();
    };
  }

  // Performance monitoring middleware
  performanceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.requestMetrics.totalRequests++;
        this.requestMetrics.requestTimes.push(responseTime);

        // Keep only last 1000 request times
        if (this.requestMetrics.requestTimes.length > 1000) {
          this.requestMetrics.requestTimes.shift();
        }

        // Track slow requests (>1000ms)
        if (responseTime > 1000) {
          this.requestMetrics.slowRequests++;
          console.warn(`Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
        }

        // Update average response time
        const times = this.requestMetrics.requestTimes;
        this.requestMetrics.averageResponseTime = times.reduce((a, b) => a + b, 0) / times.length;

        // Add performance headers
        res.set({
          'X-Response-Time': `${responseTime}ms`,
          'X-Server-Timing': `app;dur=${responseTime}`
        });
      });

      next();
    };
  }

  getPerformanceMetrics() {
    const times = this.requestMetrics.requestTimes;
    const sorted = [...times].sort((a, b) => a - b);
    
    return {
      ...this.requestMetrics,
      percentiles: {
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0
      },
      cacheStats: {
        size: this.responseCache.size,
        hitRate: this.requestMetrics.cacheHits / (this.requestMetrics.cacheHits + this.requestMetrics.cacheMisses) || 0
      }
    };
  }

  clearCache() {
    this.responseCache.clear();
  }
}

export const performanceOptimizer = new PerformanceOptimizer();

// Database connection pooling optimization
export class DatabaseOptimizer {
  private queryCache = new Map<string, any>();
  private cacheMaxSize = 500;
  private cacheTTL = 120000; // 2 minutes

  private queryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    cacheHits: 0,
    averageQueryTime: 0
  };

  async cachedQuery<T>(key: string, queryFn: () => Promise<T>, ttlSeconds: number = 120): Promise<T> {
    const cached = this.queryCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      this.queryMetrics.cacheHits++;
      return cached.data;
    }

    const startTime = Date.now();
    const result = await queryFn();
    const queryTime = Date.now() - startTime;

    this.queryMetrics.totalQueries++;
    if (queryTime > 500) {
      this.queryMetrics.slowQueries++;
      console.warn(`Slow query: ${key} - ${queryTime}ms`);
    }

    // Clean old cache entries if needed
    if (this.queryCache.size >= this.cacheMaxSize) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  getQueryMetrics() {
    return this.queryMetrics;
  }
}

export const dbOptimizer = new DatabaseOptimizer();

// Memory management utilities
export class MemoryManager {
  private memoryThreshold = 0.85; // 85% of available memory
  private gcInterval: NodeJS.Timeout | null = null;

  startMonitoring() {
    this.gcInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = usage.heapUsed / usage.heapTotal;

      if (heapUsedPercent > this.memoryThreshold) {
        console.warn(`High memory usage: ${Math.round(heapUsedPercent * 100)}%`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('Forced garbage collection');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  stopMonitoring() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }

  getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      usagePercent: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }
}

export const memoryManager = new MemoryManager();