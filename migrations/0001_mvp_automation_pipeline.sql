-- Migration: Add MVP Automation Pipeline Tables and Fields
-- Created: 2025-06-10
-- Description: Extends the existing schema to support SFTP ingestion, abandonment detection,
--              PII collection, outreach tracking, and lead export functionality

-- =============================================================================
-- EXTEND EXISTING VISITORS TABLE
-- =============================================================================

-- Add SFTP ingestion tracking fields
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS ad_click_ts TIMESTAMP;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS form_start_ts TIMESTAMP;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS form_submit_ts TIMESTAMP;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS ingest_source VARCHAR(100) DEFAULT 'manual';

-- Add complete PII fields for lead generation
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS state VARCHAR(2);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS zip VARCHAR(10);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS employer VARCHAR(255);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS annual_income INTEGER;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS time_on_job_months INTEGER;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS pii_complete BOOLEAN DEFAULT FALSE;

-- Add credit check status fields
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS credit_check_status VARCHAR(20); -- 'pending', 'approved', 'declined'
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS credit_score INTEGER;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS credit_check_date TIMESTAMP;

-- =============================================================================
-- EXTEND EXISTING SYSTEM_LEADS TABLE
-- =============================================================================

-- Add enhanced lead tracking for Boberdoo integration
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS boberdoo_status VARCHAR(20) DEFAULT 'pending'; -- 'pending', 'submitted', 'accepted', 'rejected'
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS boberdoo_response_json JSONB;
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS boberdoo_lead_id VARCHAR(100);
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS submission_attempts INTEGER DEFAULT 0;
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS last_submission_attempt TIMESTAMP;
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS credit_score INTEGER;
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS approved_amount INTEGER;
ALTER TABLE system_leads ADD COLUMN IF NOT EXISTS interest_rate VARCHAR(10); -- Store as string to handle percentages

-- =============================================================================
-- EXTEND EXISTING LEADS TABLE
-- =============================================================================

-- Add enhanced tracking fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_id VARCHAR(100) UNIQUE; -- External lead ID for tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS credit_status VARCHAR(20); -- 'approved', 'declined', 'pending'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'website';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dealer_crm_submitted BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- CREATE NEW TABLES FOR MVP AUTOMATION
-- =============================================================================

-- Outreach attempts tracking table
CREATE TABLE IF NOT EXISTS outreach_attempts (
    id SERIAL PRIMARY KEY,
    visitor_id INTEGER REFERENCES visitors(id) NOT NULL,
    channel VARCHAR(20) NOT NULL, -- 'sms', 'email'
    message_content TEXT,
    external_message_id VARCHAR(255), -- Twilio SID, SendGrid ID
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'clicked'
    return_token VARCHAR(255),
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    clicked_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB, -- Store additional data like retry attempts, etc.
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SFTP file ingestion tracking
CREATE TABLE IF NOT EXISTS ingested_files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL UNIQUE,
    file_path VARCHAR(500),
    file_size INTEGER,
    row_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'processed', -- 'processing', 'processed', 'failed'
    error_details JSONB,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Queue jobs tracking (for monitoring BullMQ jobs)
CREATE TABLE IF NOT EXISTS queue_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL,
    queue_name VARCHAR(100) NOT NULL,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'queued', 'processing', 'completed', 'failed'
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    data JSONB,
    result JSONB,
    error TEXT,
    processing_time INTEGER,
    scheduled_for TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CREATE PERFORMANCE INDEXES
-- =============================================================================

-- Visitors table indexes for abandonment detection and PII tracking
CREATE INDEX IF NOT EXISTS visitors_email_hash_idx ON visitors(email_hash);
CREATE INDEX IF NOT EXISTS visitors_session_id_idx ON visitors(session_id);
CREATE INDEX IF NOT EXISTS visitors_return_token_idx ON visitors(return_token);
CREATE INDEX IF NOT EXISTS visitors_abandonment_idx ON visitors(ad_click_ts, form_submit_ts) WHERE form_submit_ts IS NULL;
CREATE INDEX IF NOT EXISTS visitors_pii_complete_idx ON visitors(pii_complete, abandonment_step);
CREATE INDEX IF NOT EXISTS visitors_ingest_source_idx ON visitors(ingest_source);
CREATE INDEX IF NOT EXISTS visitors_last_activity_idx ON visitors(last_activity);

-- System leads indexes for Boberdoo integration
CREATE INDEX IF NOT EXISTS system_leads_boberdoo_status_idx ON system_leads(boberdoo_status);
CREATE INDEX IF NOT EXISTS system_leads_submission_attempts_idx ON system_leads(submission_attempts);
CREATE INDEX IF NOT EXISTS system_leads_created_at_idx ON system_leads(created_at);

-- Leads table indexes
CREATE INDEX IF NOT EXISTS leads_lead_id_idx ON leads(lead_id);
CREATE INDEX IF NOT EXISTS leads_visitor_id_idx ON leads(visitor_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_source_idx ON leads(source);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);

-- Outreach attempts indexes
CREATE INDEX IF NOT EXISTS outreach_attempts_visitor_id_idx ON outreach_attempts(visitor_id);
CREATE INDEX IF NOT EXISTS outreach_attempts_channel_idx ON outreach_attempts(channel);
CREATE INDEX IF NOT EXISTS outreach_attempts_status_idx ON outreach_attempts(status);
CREATE INDEX IF NOT EXISTS outreach_attempts_sent_at_idx ON outreach_attempts(sent_at);
CREATE INDEX IF NOT EXISTS outreach_attempts_return_token_idx ON outreach_attempts(return_token);

-- Ingested files indexes
CREATE INDEX IF NOT EXISTS ingested_files_file_name_idx ON ingested_files(file_name);
CREATE INDEX IF NOT EXISTS ingested_files_status_idx ON ingested_files(status);
CREATE INDEX IF NOT EXISTS ingested_files_processed_at_idx ON ingested_files(processed_at);

-- Queue jobs indexes
CREATE INDEX IF NOT EXISTS queue_jobs_job_id_idx ON queue_jobs(job_id);
CREATE INDEX IF NOT EXISTS queue_jobs_queue_name_idx ON queue_jobs(queue_name);
CREATE INDEX IF NOT EXISTS queue_jobs_status_idx ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS queue_jobs_scheduled_for_idx ON queue_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS queue_jobs_created_at_idx ON queue_jobs(created_at);

-- =============================================================================
-- INSERT DEFAULT DATA FOR MVP AUTOMATION AGENTS
-- =============================================================================

-- Add new agents to the system_agents table
INSERT INTO system_agents (id, name, status, processed_today, description, icon, color) 
VALUES 
    ('agent_5', 'SftpIngestorAgent', 'active', 0, 'Automated SFTP data ingestion from advertisers', 'Download', 'text-orange-600'),
    ('agent_6', 'AbandonmentDetectorAgent', 'active', 0, 'Identifies and flags abandoned applications', 'AlertTriangle', 'text-red-600'),
    ('agent_7', 'OutreachOrchestratorAgent', 'active', 0, 'Manages automated SMS and email outreach', 'Send', 'text-blue-600'),
    ('agent_8', 'BoberdooExportAgent', 'active', 0, 'Exports qualified leads to Boberdoo marketplace', 'ExternalLink', 'text-green-600')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color;

-- =============================================================================
-- CREATE VIEWS FOR ANALYTICS AND REPORTING
-- =============================================================================

-- Conversion funnel view
CREATE OR REPLACE VIEW conversion_funnel AS
SELECT 
    'Total Visitors' as stage,
    COUNT(*) as count,
    0 as step_order
FROM visitors

UNION ALL

SELECT 
    'Ad Clicks' as stage,
    COUNT(*) as count,
    1 as step_order
FROM visitors 
WHERE ad_click_ts IS NOT NULL

UNION ALL

SELECT 
    'Form Started' as stage,
    COUNT(*) as count,
    2 as step_order
FROM visitors 
WHERE form_start_ts IS NOT NULL

UNION ALL

SELECT 
    'Abandoned' as stage,
    COUNT(*) as count,
    3 as step_order
FROM visitors 
WHERE abandonment_detected = true

UNION ALL

SELECT 
    'Contacted' as stage,
    COUNT(DISTINCT visitor_id) as count,
    4 as step_order
FROM outreach_attempts

UNION ALL

SELECT 
    'PII Complete' as stage,
    COUNT(*) as count,
    5 as step_order
FROM visitors 
WHERE pii_complete = true

UNION ALL

SELECT 
    'Leads Submitted' as stage,
    COUNT(*) as count,
    6 as step_order
FROM leads 
WHERE status = 'submitted'

UNION ALL

SELECT 
    'Leads Accepted' as stage,
    COUNT(*) as count,
    7 as step_order
FROM system_leads 
WHERE boberdoo_status = 'accepted'

ORDER BY step_order;

-- Performance metrics view
CREATE OR REPLACE VIEW performance_metrics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_visitors,
    COUNT(CASE WHEN abandonment_detected = true THEN 1 END) as abandoned_visitors,
    COUNT(CASE WHEN pii_complete = true THEN 1 END) as pii_complete_visitors,
    ROUND(
        COUNT(CASE WHEN abandonment_detected = true THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as abandonment_rate,
    ROUND(
        COUNT(CASE WHEN pii_complete = true THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN abandonment_detected = true THEN 1 END), 0) * 100, 2
    ) as recovery_rate
FROM visitors 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- =============================================================================
-- MIGRATION COMPLETION LOG
-- =============================================================================

-- Insert activity to log the migration completion
INSERT INTO system_activities (id, type, description, agent_type, metadata, timestamp)
VALUES (
    'migration_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'database_migration',
    'MVP Automation Pipeline database migration completed successfully',
    'System',
    '{
        "migration_version": "0001_mvp_automation_pipeline",
        "tables_added": ["outreach_attempts", "ingested_files", "queue_jobs"],
        "tables_modified": ["visitors", "system_leads", "leads"],
        "indexes_created": 20,
        "views_created": ["conversion_funnel", "performance_metrics"]
    }'::jsonb,
    NOW()
);

-- Output completion message
SELECT 'MVP Automation Pipeline migration completed successfully!' as migration_status;
