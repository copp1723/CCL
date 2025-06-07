import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";
import config from "./config/environment";

neonConfig.webSocketConstructor = ws;

// Database connection with error handling
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.error('DATABASE_URL is required in production');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-optimized connection pool configuration
const dbConfig = config.getDbConfig();
export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  max: dbConfig.max,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

export const db = drizzle({ client: pool, schema });