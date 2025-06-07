
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from './config/environment';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private client: postgres.Sql | null = null;
  private db: any = null;
  private connectionAttempts = 0;
  private maxRetries = 5;
  private retryDelay = 2000;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async connect(): Promise<any> {
    if (this.db) {
      return this.db;
    }

    try {
      const dbUrl = config.get().DATABASE_URL;
      
      if (!dbUrl) {
        console.warn('DATABASE_URL not found, using in-memory storage');
        return null;
      }

      this.client = postgres(dbUrl, {
        max: 20,
        idle_timeout: 30,
        connect_timeout: 10,
        ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
        onnotice: () => {}, // Suppress notices in production
        transform: {
          undefined: null
        }
      });

      // Test connection
      await this.client`SELECT 1`;
      
      this.db = drizzle(this.client);
      this.connectionAttempts = 0;
      
      console.log('✅ Database connected successfully');
      return this.db;

    } catch (error: any) {
      this.connectionAttempts++;
      console.error(`❌ Database connection failed (attempt ${this.connectionAttempts}):`, error.message);

      if (this.connectionAttempts < this.maxRetries) {
        console.log(`Retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      console.error('Max database connection retries exceeded. Using in-memory storage.');
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.db = null;
    }
  }

  getDb() {
    return this.db;
  }
}

export const dbManager = DatabaseManager.getInstance();
export default dbManager;
