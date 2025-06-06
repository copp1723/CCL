
-- Performance indexes for system tables
CREATE INDEX IF NOT EXISTS idx_system_leads_email ON system_leads(email);
CREATE INDEX IF NOT EXISTS idx_system_leads_status ON system_leads(status);
CREATE INDEX IF NOT EXISTS idx_system_leads_created_at ON system_leads(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_system_leads_status_created ON system_leads(status, created_at DESC);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_system_activities_type ON system_activities(type);
CREATE INDEX IF NOT EXISTS idx_system_activities_timestamp ON system_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_activities_agent_type ON system_activities(agent_type);

-- Agent indexes
CREATE INDEX IF NOT EXISTS idx_system_agents_status ON system_agents(status);
CREATE INDEX IF NOT EXISTS idx_system_agents_name ON system_agents(name);

-- Visitor tracking indexes
CREATE INDEX IF NOT EXISTS idx_visitors_email_hash ON visitors(email_hash);
CREATE INDEX IF NOT EXISTS idx_visitors_session_id ON visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_visitors_last_activity ON visitors(last_activity DESC);

-- Chat session indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_visitor_id ON chat_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- Email campaign indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_visitor_id ON email_campaigns(visitor_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_return_token ON email_campaigns(return_token);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_email_sent ON email_campaigns(email_sent);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_expires_at ON email_campaigns(expires_at);
