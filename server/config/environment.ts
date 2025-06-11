import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.string().transform(Number).default(5000),

  // Security
  JWT_SECRET: z.string().min(32).default("ccl-dev-secret-key-change-in-production"),
  API_KEY: z.string().default("ccl-internal-2025"),
  INTERNAL_API_KEY: z.string().default("ccl-internal-2025"),

  // Database
  DATABASE_URL: z.string().optional(),

  // External Services
  OPENAI_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().default("mail.onerylie.com"),
  FLEXPATH_API_KEY: z.string().optional(),

  // SFTP Configuration for Lead Ingestion
  SFTP_HOST: z.string().optional(),
  SFTP_PORT: z.string().default("22"),
  SFTP_USER: z.string().optional(),
  SFTP_PASSWORD: z.string().optional(),
  SFTP_REMOTE_PATH: z.string().default("/inbound"),
  SFTP_POLL_INTERVAL_MINUTES: z.string().transform(Number).default(15),

  // Queue & Workers (Redis for BullMQ)
  REDIS_URL: z.string().default("redis://localhost:6379"),
  BULL_CONCURRENCY: z.string().transform(Number).default(5),

  // Messaging Services for Outreach
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  OUTBOUND_PHONE_NUMBER: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  OUTBOUND_EMAIL_FROM: z.string().email().default("noreply@completecarloans.com"),

  // Lead Export & Monetization
  BOBERDOO_URL: z.string().optional(),
  BOBERDOO_VENDOR_ID: z.string().optional(),
  BOBERDOO_VENDOR_PASSWORD: z.string().optional(),
  BOBERDOO_TIMEOUT_MS: z.string().transform(Number).default(10000),

  // Abandonment Detection
  ABANDONMENT_THRESHOLD_MINUTES: z.string().transform(Number).default(15),
  RETURN_TOKEN_EXPIRY_HOURS: z.string().transform(Number).default(48),

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

    // MVP Automation Pipeline Status
    console.log("📋 MVP Automation Pipeline:");
    const sftpConfig = this.getSftpConfig();
    console.log(
      `   SFTP Ingestion: ${sftpConfig.configured ? "✅ Configured" : "⚠️  Not configured"}`
    );
    const messagingConfig = this.getMessagingConfig();
    console.log(
      `   Twilio SMS: ${messagingConfig.twilio.configured ? "✅ Configured" : "⚠️  Not configured"}`
    );
    console.log(
      `   SendGrid Email: ${messagingConfig.sendgrid.configured ? "✅ Configured" : "⚠️  Not configured"}`
    );
    const boberdooConfig = this.getBoberdooConfig();
    console.log(
      `   Boberdoo Export: ${boberdooConfig.configured ? "✅ Configured" : "⚠️  Not configured"}`
    );

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

  // MVP Automation Pipeline Configuration
  getSftpConfig() {
    return {
      host: this.config.SFTP_HOST,
      port: parseInt(this.config.SFTP_PORT),
      user: this.config.SFTP_USER,
      password: this.config.SFTP_PASSWORD,
      remotePath: this.config.SFTP_REMOTE_PATH,
      pollIntervalMinutes: this.config.SFTP_POLL_INTERVAL_MINUTES,
      configured: !!(this.config.SFTP_HOST && this.config.SFTP_USER && this.config.SFTP_PASSWORD),
    };
  }

  getQueueConfig() {
    return {
      redisUrl: this.config.REDIS_URL,
      concurrency: this.config.BULL_CONCURRENCY,
    };
  }

  getMessagingConfig() {
    return {
      twilio: {
        accountSid: this.config.TWILIO_ACCOUNT_SID,
        authToken: this.config.TWILIO_AUTH_TOKEN,
        outboundNumber: this.config.OUTBOUND_PHONE_NUMBER,
        configured: !!(this.config.TWILIO_ACCOUNT_SID && this.config.TWILIO_AUTH_TOKEN),
      },
      sendgrid: {
        apiKey: this.config.SENDGRID_API_KEY,
        fromEmail: this.config.OUTBOUND_EMAIL_FROM,
        configured: !!this.config.SENDGRID_API_KEY,
      },
    };
  }

  getBoberdooConfig() {
    return {
      url: this.config.BOBERDOO_URL,
      vendorId: this.config.BOBERDOO_VENDOR_ID,
      vendorPassword: this.config.BOBERDOO_VENDOR_PASSWORD,
      timeoutMs: this.config.BOBERDOO_TIMEOUT_MS,
      configured: !!(this.config.BOBERDOO_URL && this.config.BOBERDOO_VENDOR_ID),
    };
  }

  getAbandonmentConfig() {
    return {
      thresholdMinutes: this.config.ABANDONMENT_THRESHOLD_MINUTES,
      returnTokenExpiryHours: this.config.RETURN_TOKEN_EXPIRY_HOURS,
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

  // Production readiness validation
  validateProductionReadiness(): { ready: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check security settings
    if (this.config.JWT_SECRET === "ccl-dev-secret-key-change-in-production") {
      issues.push("JWT_SECRET is using default value");
    }
    if (this.config.API_KEY === "ccl-internal-2025") {
      issues.push("API_KEY is using default value");
    }

    // Check required services
    if (!this.config.DATABASE_URL) {
      issues.push("Database URL not configured");
    }
    if (!this.config.MAILGUN_API_KEY) {
      issues.push("Email service (Mailgun) not configured");
    }
    if (!this.config.OPENAI_API_KEY) {
      issues.push("AI service (OpenAI) not configured");
    }

    // Check production-specific settings
    if (this.config.NODE_ENV === "production") {
      if (this.config.CORS_ORIGIN === "*") {
        issues.push("CORS is allowing all origins in production");
      }
      if (this.config.LOG_LEVEL === "debug") {
        issues.push("Debug logging enabled in production");
      }
    }

    return {
      ready: issues.length === 0,
      issues,
    };
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
