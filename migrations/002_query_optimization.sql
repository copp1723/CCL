-- Query Optimization Views and Functions
-- Complete Car Loans Agent System

-- Materialized view for dashboard statistics (updated periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM system_leads) as total_leads,
    (SELECT COUNT(*) FROM system_leads WHERE status = 'new') as new_leads,
    (SELECT COUNT(*) FROM system_leads WHERE status = 'contacted') as contacted_leads,
    (SELECT COUNT(*) FROM system_leads WHERE status = 'qualified') as qualified_leads,
    (SELECT COUNT(*) FROM system_activities) as total_activities,
    (SELECT COUNT(*) FROM system_agents WHERE status = 'active') as active_agents,
    (SELECT COUNT(*) FROM visitors) as total_visitors,
    NOW() as last_updated;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_updated ON dashboard_stats(last_updated);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- View for recent agent activities (last 24 hours)
CREATE OR REPLACE VIEW recent_agent_activities AS
SELECT 
    sa.id,
    sa.type,
    sa.description,
    sa.agent_type,
    sa.metadata,
    sa.created_at,
    sag.name as agent_name,
    sag.status as agent_status
FROM system_activities sa
LEFT JOIN system_agents sag ON sa.agent_type = sag.name
WHERE sa.created_at > NOW() - INTERVAL '24 hours'
ORDER BY sa.created_at DESC;

-- View for lead pipeline summary
CREATE OR REPLACE VIEW lead_pipeline_summary AS
SELECT 
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours,
    MIN(created_at) as oldest_lead,
    MAX(created_at) as newest_lead
FROM system_leads 
GROUP BY status;

-- Function for efficient lead search
CREATE OR REPLACE FUNCTION search_leads(
    search_email text DEFAULT NULL,
    search_status text DEFAULT NULL,
    days_back integer DEFAULT 30,
    result_limit integer DEFAULT 100
)
RETURNS TABLE(
    id text,
    email text,
    status text,
    created_at timestamp with time zone,
    lead_data jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.id,
        sl.email,
        sl.status,
        sl.created_at,
        sl.lead_data
    FROM system_leads sl
    WHERE 
        (search_email IS NULL OR sl.email ILIKE '%' || search_email || '%')
        AND (search_status IS NULL OR sl.status = search_status)
        AND sl.created_at > NOW() - INTERVAL '1 day' * days_back
    ORDER BY sl.created_at DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for activity statistics by agent
CREATE OR REPLACE FUNCTION agent_activity_stats(days_back integer DEFAULT 7)
RETURNS TABLE(
    agent_type text,
    activity_count bigint,
    unique_activity_types bigint,
    first_activity timestamp with time zone,
    last_activity timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.agent_type,
        COUNT(*) as activity_count,
        COUNT(DISTINCT sa.type) as unique_activity_types,
        MIN(sa.created_at) as first_activity,
        MAX(sa.created_at) as last_activity
    FROM system_activities sa
    WHERE sa.created_at > NOW() - INTERVAL '1 day' * days_back
    GROUP BY sa.agent_type
    ORDER BY activity_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function for visitor engagement tracking
CREATE OR REPLACE FUNCTION visitor_engagement_summary(days_back integer DEFAULT 30)
RETURNS TABLE(
    total_visitors bigint,
    visitors_with_email bigint,
    visitors_with_phone bigint,
    active_chat_sessions bigint,
    avg_session_duration interval
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT v.id) as total_visitors,
        COUNT(DISTINCT CASE WHEN v.email IS NOT NULL THEN v.id END) as visitors_with_email,
        COUNT(DISTINCT CASE WHEN v.phone_number IS NOT NULL THEN v.id END) as visitors_with_phone,
        COUNT(DISTINCT cs.id) as active_chat_sessions,
        AVG(cs.ended_at - cs.created_at) as avg_session_duration
    FROM visitors v
    LEFT JOIN chat_sessions cs ON v.id = cs.visitor_id
    WHERE v.created_at > NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;

-- Optimized query for agent performance metrics
CREATE OR REPLACE VIEW agent_performance_metrics AS
SELECT 
    ag.id,
    ag.name,
    ag.status,
    ag.processed_today,
    COUNT(sa.id) as total_activities_7d,
    COUNT(DISTINCT sa.type) as activity_types_7d,
    MAX(sa.created_at) as last_activity_time,
    ag.last_activity
FROM system_agents ag
LEFT JOIN system_activities sa ON ag.name = sa.agent_type 
    AND sa.created_at > NOW() - INTERVAL '7 days'
GROUP BY ag.id, ag.name, ag.status, ag.processed_today, ag.last_activity;

-- Function to clean old data (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Clean old activities
    DELETE FROM system_activities 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean old chat sessions
    DELETE FROM chat_sessions 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    -- Update statistics
    ANALYZE system_activities;
    ANALYZE chat_sessions;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled refresh of materialized view (requires pg_cron extension)
-- SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', 'SELECT refresh_dashboard_stats();');

-- Optimize PostgreSQL settings for performance
-- These would typically be set in postgresql.conf
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.track = all
-- work_mem = '256MB'
-- maintenance_work_mem = '1GB'
-- effective_cache_size = '8GB'
-- random_page_cost = 1.1

-- Update all table statistics
ANALYZE;