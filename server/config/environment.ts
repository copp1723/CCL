import { z } from "zod";

// Environment configuration schema with validation
const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.string().transform(Number).default("5000"),
  
  // Database
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  DB_POOL_SIZE: z.string().transform(Number).default("20"),
  DB_IDLE_TIMEOUT: z.string().transform(Number).default("30000"),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number).default("60000"),
  
  // Authentication
  INTERNAL_API_KEY: z.string().default("ccl-internal-2025"),
  JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  
  // Email Services
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().default("onerylie.com"),
  MAILGUN_FROM_EMAIL: z.string().default("noreply@onerylie.com"),
  
  // External APIs
  OPENAI_API_KEY: z.string().optional(),
  FLEXPATH_API_KEY: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default("60000"),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default("100"),
  
  // Monitoring
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  METRICS_ENABLED: z.string().transform(val => val === "true").default("true"),
  HEALTH_CHECK_TIMEOUT: z.string().transform(Number).default("5000"),
  
  // Security
  CORS_ORIGIN: z.string().default("*"),
  TRUST_PROXY: z.string().transform(val => val === "true").default("false"),
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

class ConfigManager {
  private config: EnvironmentConfig;
  private isProduction: boolean;
  private isStaging: boolean;

  constructor() {
    this.config = this.validateEnvironment();
    this.isProduction = this.config.NODE_ENV === "production";
    this.isStaging = this.config.NODE_ENV === "staging";
  }

  private validateEnvironment(): EnvironmentConfig {
    try {
      return environmentSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Environment validation failed:");
        error.errors.forEach(err => {
          console.error(`  ${err.path.join(".")}: ${err.message}`);
        });
        process.exit(1);
      }
      throw error;
    }
  }

  get(): EnvironmentConfig {
    return this.config;
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === "development";
  }

  isProductionMode(): boolean {
    return this.isProduction;
  }

  isStagingMode(): boolean {
    return this.isStaging;
  }

  getDbConfig() {
    return {
      connectionString: this.config.DATABASE_URL,
      max: this.config.DB_POOL_SIZE,
      idleTimeoutMillis: this.config.DB_IDLE_TIMEOUT,
      connectionTimeoutMillis: this.config.DB_CONNECTION_TIMEOUT,
    };
  }

  getRateLimitConfig() {
    return {
      windowMs: this.config.RATE_LIMIT_WINDOW_MS,
      max: this.config.RATE_LIMIT_MAX_REQUESTS,
    };
  }

  getLogLevel(): string {
    return this.config.LOG_LEVEL;
  }

  requireSecret(key: keyof EnvironmentConfig, service: string): string {
    const value = this.config[key];
    if (!value) {
      throw new Error(`${key} is required for ${service} functionality`);
    }
    return value as string;
  }

  validateProductionReadiness(): { ready: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.isProduction) {
      if (!this.config.JWT_SECRET) issues.push("JWT_SECRET required for production");
      if (!this.config.SESSION_SECRET) issues.push("SESSION_SECRET required for production");
      if (this.config.INTERNAL_API_KEY === "ccl-internal-2025") {
        issues.push("Default API key must be changed for production");
      }
      if (!this.config.MAILGUN_API_KEY) issues.push("MAILGUN_API_KEY required for email functionality");
      if (!this.config.OPENAI_API_KEY) issues.push("OPENAI_API_KEY required for AI agents");
    }

    return {
      ready: issues.length === 0,
      issues
    };
  }
}

export const config = new ConfigManager();
export default config;