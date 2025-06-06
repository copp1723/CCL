-- Database Performance Optimization Indexes
-- Complete Car Loans Agent System

-- System Leads Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_email ON system_leads(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_status ON system_leads(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_created_at ON system_leads(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_status_created ON system_leads(status, created_at DESC);

-- System Activities Indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_type ON system_activities(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_agent_type ON system_activities(agent_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_created_at ON system_activities(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_type_created ON system_activities(type, created_at DESC);

-- System Agents Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_agents_status ON system_agents(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_agents_last_activity ON system_agents(last_activity DESC);

-- Visitors Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitors_ip_address ON visitors(ip_address);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitors_email ON visitors(email) WHERE email IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitors_phone ON visitors(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);

-- Chat Sessions Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_visitor_id ON chat_sessions(visitor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- Email Campaigns Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_name ON email_campaigns(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at DESC);

-- Leads Indexes (if FlexPath restored)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_visitor_id ON leads(visitor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Agent Activity Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_activity_agent_name ON agent_activity(agent_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_activity_activity_type ON agent_activity(activity_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_activity_created_at ON agent_activity(created_at DESC);

-- Sessions Indexes (for authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Composite Indexes for Common Queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_email_status ON system_leads(email, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_agent_created ON system_activities(agent_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitors_ip_created ON visitors(ip_address, created_at DESC);

-- Partial Indexes for Better Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_active ON system_leads(created_at DESC) 
  WHERE status IN ('new', 'contacted', 'qualified');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_recent ON system_activities(created_at DESC) 
  WHERE created_at > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_agents_active ON system_agents(id, name) 
  WHERE status = 'active';

-- Text Search Indexes (if needed for search functionality)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_leads_data_gin ON system_leads USING gin(lead_data);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_activities_metadata_gin ON system_activities USING gin(metadata);

-- Update statistics after index creation
ANALYZE system_leads;
ANALYZE system_activities;
ANALYZE system_agents;
ANALYZE visitors;
ANALYZE chat_sessions;
ANALYZE email_campaigns;
ANALYZE leads;
ANALYZE agent_activity;
ANALYZE sessions;