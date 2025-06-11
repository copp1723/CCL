const { Pool } = require("pg");

// Test database connection
async function testConnection() {
  console.log("🔍 Testing Database Connection...\n");

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not set in environment variables");
    console.log("\nTo test locally, run:");
    console.log('DATABASE_URL="your-connection-string" node test-db-connection.js');
    return;
  }

  // Parse and display connection info (hide password)
  try {
    const url = new URL(databaseUrl);
    console.log("📊 Connection Details:");
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Port: ${url.port || "5432"}`);
    console.log(`  Database: ${url.pathname.slice(1)}`);
    console.log(`  User: ${url.username}`);
    console.log(`  SSL: ${url.searchParams.get("sslmode") || "require"}`);
    console.log(`  Password: ${url.password ? "***hidden***" : "not set"}`);
    console.log("");
  } catch (e) {
    console.error("❌ Invalid DATABASE_URL format");
    return;
  }

  // Test connection with different configurations
  const configs = [
    {
      name: "Standard SSL",
      config: {
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      name: "SSL Require",
      config: {
        connectionString: databaseUrl,
        ssl: "require",
      },
    },
    {
      name: "No SSL",
      config: {
        connectionString: databaseUrl,
        ssl: false,
      },
    },
  ];

  for (const { name, config } of configs) {
    console.log(`\n🧪 Testing with ${name}...`);
    const pool = new Pool({
      ...config,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });

    try {
      const start = Date.now();
      const result = await pool.query("SELECT NOW() as current_time, version() as pg_version");
      const elapsed = Date.now() - start;

      console.log(`✅ SUCCESS with ${name}!`);
      console.log(`  Response time: ${elapsed}ms`);
      console.log(`  Server time: ${result.rows[0].current_time}`);
      console.log(`  PostgreSQL: ${result.rows[0].pg_version.split(",")[0]}`);

      // Test table access
      try {
        await pool.query(
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        );
        console.log("  ✅ Can query tables");
      } catch (e) {
        console.log("  ⚠️  Cannot query tables:", e.message);
      }

      await pool.end();
      console.log("\n🎉 Database connection successful!");
      console.log(`\n💡 Use this configuration in your app:`);
      console.log(`   ssl: ${JSON.stringify(config.ssl)}`);
      return;
    } catch (error) {
      console.log(`❌ FAILED with ${name}`);
      console.log(`  Error: ${error.message}`);
      if (error.code) console.log(`  Code: ${error.code}`);
      await pool.end();
    }
  }

  console.log("\n❌ All connection attempts failed");
  console.log("\n🔧 Troubleshooting steps:");
  console.log("1. Check if the database service is running in Render dashboard");
  console.log("2. Verify the DATABASE_URL in Render environment variables");
  console.log("3. Ensure the database allows connections from your app");
  console.log("4. Check Render database logs for connection attempts");
}

// Run the test
testConnection().catch(console.error);
