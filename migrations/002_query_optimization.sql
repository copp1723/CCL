
-- Optimized view for active leads summary
CREATE OR REPLACE VIEW active_leads_summary AS
SELECT 
  status,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as date_created
FROM system_leads 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status, DATE_TRUNC('day', created_at)
ORDER BY date_created DESC;

-- Optimized view for agent performance
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  sa.id,
  sa.name,
  sa.status,
  sa.processed_today,
  COUNT(sact.id) as total_activities,
  MAX(sact.timestamp) as last_activity
FROM system_agents sa
LEFT JOIN system_activities sact ON sact.agent_type = sa.name
WHERE sact.timestamp >= NOW() - INTERVAL '24 hours' OR sact.timestamp IS NULL
GROUP BY sa.id, sa.name, sa.status, sa.processed_today;

-- Function for efficient lead status updates
CREATE OR REPLACE FUNCTION update_lead_status(lead_id TEXT, new_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE system_leads 
  SET status = new_status 
  WHERE id = lead_id;
  
  IF FOUND THEN
    INSERT INTO system_activities (id, type, description, timestamp)
    VALUES (
      'activity_' || EXTRACT(epoch FROM NOW()) || '_' || lead_id,
      'lead_status_change',
      'Lead ' || lead_id || ' status changed to ' || new_status,
      NOW()
    );
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
