export function validateEnvironment() {
  const required = ["NODE_ENV"];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Validate port
  const port = parseInt(process.env.PORT || "5000");
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("Invalid PORT value");
    process.exit(1);
  }

  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: port,
    DATABASE_URL: process.env.DATABASE_URL,
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
  };
}
