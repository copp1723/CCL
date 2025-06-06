
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import { db } from '../db';

interface QueryStats {
  query: string;
  executionTime: number;
  timestamp: Date;
}

class DatabaseOptimizer {
  private queryStats: QueryStats[] = [];
  private slowQueryThreshold = 1000; // 1 second

  constructor() {
    // Log slow queries for optimization
    this.setupQueryMonitoring();
  }

  private setupQueryMonitoring(): void {
    // Monitor query performance
    setInterval(() => {
      this.analyzeQueryPerformance();
    }, 300000); // Every 5 minutes
  }

  private async analyzeQueryPerformance(): Promise<void> {
    try {
      // Get slow queries from PostgreSQL logs
      const slowQueries = await db.execute(sql`
        SELECT query, mean_exec_time, calls
        FROM pg_stat_statements 
        WHERE mean_exec_time > ${this.slowQueryThreshold}
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);

      if (slowQueries.length > 0) {
        console.log('[DB_OPTIMIZER] Detected slow queries:', slowQueries);
      }
    } catch (error) {
      // pg_stat_statements might not be enabled, that's ok
      console.log('[DB_OPTIMIZER] Query monitoring not available');
    }
  }

  async optimizeConnection(): Promise<void> {
    try {
      // Optimize connection settings
      await db.execute(sql`SET work_mem = '64MB'`);
      await db.execute(sql`SET shared_buffers = '256MB'`);
      await db.execute(sql`SET effective_cache_size = '1GB'`);
      
      console.log('[DB_OPTIMIZER] Connection optimization applied');
    } catch (error) {
      console.log('[DB_OPTIMIZER] Could not apply connection optimization:', error);
    }
  }

  async runMaintenance(): Promise<void> {
    try {
      // Analyze tables for better query planning
      await db.execute(sql`ANALYZE system_leads`);
      await db.execute(sql`ANALYZE system_activities`);
      await db.execute(sql`ANALYZE system_agents`);
      await db.execute(sql`ANALYZE visitors`);
      await db.execute(sql`ANALYZE chat_sessions`);
      await db.execute(sql`ANALYZE email_campaigns`);

      console.log('[DB_OPTIMIZER] Database maintenance completed');
    } catch (error) {
      console.error('[DB_OPTIMIZER] Maintenance failed:', error);
    }
  }

  async getConnectionStats(): Promise<any> {
    try {
      const stats = await db.execute(sql`
        SELECT 
          numbackends as active_connections,
          xact_commit as transactions_committed,
          xact_rollback as transactions_rolled_back,
          blks_read as blocks_read,
          blks_hit as blocks_hit,
          tup_returned as tuples_returned,
          tup_fetched as tuples_fetched
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      return stats[0] || {};
    } catch (error) {
      console.error('[DB_OPTIMIZER] Could not get connection stats:', error);
      return {};
    }
  }
}

export const dbOptimizer = new DatabaseOptimizer();

// Enhanced connection pool configuration
export function createOptimizedPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of connections
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Timeout for new connections
  });
}
