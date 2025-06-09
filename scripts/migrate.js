/**
 * Database Migration Script for Render Deployment
 * Automatically runs on deployment to ensure database schema is ready
 */

import { Pool } from "pg";

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

async function migrateDatabase() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      if (!process.env.DATABASE_URL) {
        console.log("⚠️  No DATABASE_URL found, skipping migration");
        return;
      }

      console.log(`🔄 Attempt ${i + 1}/${MAX_RETRIES}: Running database migrations...`);

      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });

      await pool.connect();
      console.log("✅ Database connection successful.");

      const createTablesQuery = `
        CREATE TABLE IF NOT EXISTS leads (
          id VARCHAR(32) PRIMARY KEY,
          email TEXT NOT NULL,
          phone_number TEXT,
          status VARCHAR(20) DEFAULT 'new',
          lead_data JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS activities (
          id VARCHAR(32) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          description TEXT NOT NULL,
          agent_type VARCHAR(50),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS visitors (
          id VARCHAR(32) PRIMARY KEY,
          session_id VARCHAR(32) NOT NULL,
          phone_number TEXT,
          email TEXT,
          ip_address INET,
          user_agent TEXT,
          metadata JSONB,
          return_token VARCHAR(64),
          return_token_expiry TIMESTAMP,
          abandonment_step INTEGER DEFAULT 0,
          last_activity TIMESTAMP DEFAULT NOW(),
          abandonment_detected BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
        CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
        CREATE INDEX IF NOT EXISTS idx_visitors_session_id ON visitors(session_id);

      -- Phase 2: Email Campaign & AI Takeover Tables
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        goal_prompt TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        sequence_order INT NOT NULL,
        delay_hours INT DEFAULT 24,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_campaign_status (
        lead_id VARCHAR(32) REFERENCES leads(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        current_step INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'in_progress', -- e.g., in_progress, replied, completed, unsubscribed
        next_touch_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (lead_id, campaign_id)
      );

      CREATE INDEX IF NOT EXISTS idx_campaign_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_lead_campaign_status_next_touch ON lead_campaign_status(next_touch_at);
      CREATE INDEX IF NOT EXISTS idx_lead_campaign_status_status ON lead_campaign_status(status);
      `;

      await pool.query(createTablesQuery);
      console.log("✅ Database schema updated successfully.");

      await pool.end();
      console.log("🎉 Database migration completed successfully.");
      return; // Exit the loop on success
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message);
      if (i < MAX_RETRIES - 1) {
        console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      } else {
        console.error("💥 All migration attempts failed. Exiting.");
        process.exit(1);
      }
    }
  }
}

// Run migration
migrateDatabase()
  .then(() => {
    console.log("🎉 Database migration completed successfully.");
    process.exit(0); // Explicitly exit with success code
  })
  .catch(error => {
    console.error("💥 Migration error:", error);
    process.exit(1); // Exit with failure code
  });
