import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not configured - running in fallback mode");
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

let pool: Pool;
let db: ReturnType<typeof drizzle>;

try {
  // Standard PostgreSQL configuration for Render
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    // Render PostgreSQL requires SSL in production
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Connection pool settings optimized for Render
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "5000", 10),
  });
  
  // Use standard PostgreSQL driver, not Neon
  db = drizzle(pool, { schema });
  
  console.log("✅ PostgreSQL database configuration successful");
} catch (error) {
  console.error("❌ PostgreSQL database configuration failed:", error);
  throw error;
}

export { pool, db };