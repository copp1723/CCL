import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.string().transform(Number).default(5000),

  // Security
  JWT_SECRET: z.string().min(32).default("ccl-dev-secret-key-change-in-production"),
  API_KEY: z.string().default("ccl-internal-2025"),

  // Database
  DATABASE_URL: z.string().optional(),

  // External Services
  OPENAI_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().default("mail.onerylie.com"),
  FLEXPATH_API_KEY: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().default("*"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),

  // Performance
  MEMORY_THRESHOLD: z.string().transform(Number).default(85),
  CACHE_TTL_MINUTES: z.string().transform(Number).default(5),

  // Monitoring
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  ENABLE_METRICS: z.string().transform(Boolean).default(true),
});

type Environment = z.infer<typeof envSchema>;

class ConfigManager {
  private static instance: ConfigManager;
  private config: Environment;
  private validated = false;

  private constructor() {
    this.config = this.validateEnvironment();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private validateEnvironment(): Environment {
    try {
      const config = envSchema.parse(process.env);
      this.validated = true;

      // Log configuration status
      this.logConfigurationStatus(config);

      return config;
    } catch (error) {
      console.error("❌ Environment validation failed:", error);
      console.error("Using default configuration. Please check your environment variables.");

      // Return safe defaults
      return envSchema.parse({});
    }
  }

  private logConfigurationStatus(config: Environment): void {
    console.log("🔧 Configuration Status:");
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Port: ${config.PORT}`);
    console.log(
      `   Database: ${config.DATABASE_URL ? "✅ Configured" : "⚠️  Using in-memory storage"}`
    );
    console.log(`   OpenAI: ${config.OPENAI_API_KEY ? "✅ Configured" : "⚠️  Not configured"}`);
    console.log(`   Mailgun: ${config.MAILGUN_API_KEY ? "✅ Configured" : "⚠️  Not configured"}`);
    console.log(`   FlexPath: ${config.FLEXPATH_API_KEY ? "✅ Configured" : "⚠️  Not configured"}`);
    console.log(`   Security: ${this.isSecure() ? "✅ Production ready" : "⚠️  Development mode"}`);
  }

  get(): Environment {
    return this.config;
  }

  isValidated(): boolean {
    return this.validated;
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === "development";
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === "production";
  }

  isStaging(): boolean {
    return this.config.NODE_ENV === "staging";
  }

  isSecure(): boolean {
    return (
      this.config.JWT_SECRET !== "ccl-dev-secret-key-change-in-production" &&
      this.config.API_KEY !== "ccl-internal-2025" &&
      this.isProduction()
    );
  }

  getSecurityConfig() {
    return {
      jwtSecret: this.config.JWT_SECRET,
      apiKey: this.config.API_KEY,
      corsOrigin: this.config.CORS_ORIGIN,
      rateLimitWindow: this.config.RATE_LIMIT_WINDOW_MS,
      rateLimitMax: this.config.RATE_LIMIT_MAX_REQUESTS,
    };
  }

  getDatabaseConfig() {
    return {
      url: this.config.DATABASE_URL,
      isConfigured: !!this.config.DATABASE_URL,
    };
  }

  getExternalServices() {
    return {
      openai: {
        apiKey: this.config.OPENAI_API_KEY,
        configured: !!this.config.OPENAI_API_KEY,
      },
      mailgun: {
        apiKey: this.config.MAILGUN_API_KEY,
        domain: this.config.MAILGUN_DOMAIN,
        configured: !!this.config.MAILGUN_API_KEY,
      },
      flexpath: {
        apiKey: this.config.FLEXPATH_API_KEY,
        configured: !!this.config.FLEXPATH_API_KEY,
      },
    };
  }

  getPerformanceConfig() {
    return {
      memoryThreshold: this.config.MEMORY_THRESHOLD,
      cacheTtl: this.config.CACHE_TTL_MINUTES * 60 * 1000, // Convert to milliseconds
      enableMetrics: this.config.ENABLE_METRICS,
    };
  }

  // Runtime validation
  validateForProduction(): string[] {
    const errors: string[] = [];

    if (this.config.NODE_ENV === "production") {
      if (this.config.JWT_SECRET === "ccl-dev-secret-key-change-in-production") {
        errors.push("JWT_SECRET must be changed from default value in production");
      }

      if (this.config.API_KEY === "ccl-internal-2025") {
        errors.push("API_KEY must be changed from default value in production");
      }

      if (this.config.CORS_ORIGIN === "*") {
        errors.push("CORS_ORIGIN should not be wildcard (*) in production");
      }

      if (!this.config.DATABASE_URL) {
        errors.push("DATABASE_URL is required in production");
      }
    }

    return errors;
  }
}

const config = ConfigManager.getInstance();

// Validate production requirements
if (config.isProduction()) {
  const errors = config.validateForProduction();
  if (errors.length > 0) {
    console.error("❌ Production configuration errors:");
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error("Invalid production configuration");
  }
}

export default config;
