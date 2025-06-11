import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../shared/schema";

// RENDER FIX: Conditional WebSocket configuration
if (process.env.NODE_ENV === "production" && process.env.RENDER_DEPLOYMENT === "true") {
  // For Render deployment, use fetch-based connection without WebSockets
  neonConfig.useSecureWebSocket = false;
  neonConfig.wsProxy = (host, port) => `${host}:${port}/v1`;
  neonConfig.pipelineConnect = false;

  // Override fetch to handle connection issues
  neonConfig.fetchFunction = async (...args) => {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(...args);
        if (!response.ok && response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error;
        console.warn(`Database fetch attempt ${i + 1} failed:`, error);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    throw lastError;
  };
} else {
  // For local development, use WebSocket if available
  try {
    const ws = await import("ws");
    neonConfig.webSocketConstructor = ws.default;
  } catch (error) {
    console.warn("WebSocket not available, using HTTP fallback");
  }
}

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not configured - running in fallback mode");
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

let pool: Pool;
let db: ReturnType<typeof drizzle>;

try {
  // Parse DATABASE_URL to check if it's using pooled connection
  const dbUrl = new URL(process.env.DATABASE_URL);
  const isPooled = dbUrl.hostname.includes("-pooler.");

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    // Reduce connection timeout for faster fallback
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "5000", 10),
    // Use fewer connections in production
    max: process.env.NODE_ENV === "production" ? 5 : 20,
  });

  db = drizzle({ client: pool, schema });

  console.log(`✅ Database configuration successful (pooled: ${isPooled})`);
} catch (error) {
  console.error("❌ Database configuration failed:", error);
  throw error;
}

export { pool, db };
