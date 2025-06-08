/**
 * Database Migration Script for Render Deployment
 * Automatically runs on deployment to ensure database schema is ready
 */

import { Pool } from 'pg';

async function migrateDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL found, skipping migration');
    return;
  }

  console.log('🔄 Running database migrations...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Create tables if they don't exist
    const createTablesQuery = `
      -- Leads table with encryption support
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(32) PRIMARY KEY,
        email TEXT NOT NULL,
        phone_number TEXT,
        status VARCHAR(20) DEFAULT 'new',
        lead_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Activities table for tracking user actions
      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(32) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        agent_type VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Visitors table for website tracking
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

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
      CREATE INDEX IF NOT EXISTS idx_visitors_session_id ON visitors(session_id);
      CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at);

      -- Add any missing columns (for future updates)
      DO $$ 
      BEGIN
        -- Example: Add new columns here if needed in future updates
        -- ALTER TABLE leads ADD COLUMN IF NOT EXISTS new_field TEXT;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END $$;
    `;

    await pool.query(createTablesQuery);
    console.log('✅ Database schema updated successfully');

    // Verify tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'activities', 'visitors')
    `);

    console.log(`✅ Verified ${tableCheck.rows.length} tables exist:`, 
      tableCheck.rows.map(row => row.table_name).join(', '));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateDatabase().then(() => {
  console.log('🎉 Database migration completed');
}).catch(error => {
  console.error('💥 Migration error:', error);
  process.exit(1);
});