export interface LeadData {
  id: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  email: string;
  leadData: any;
}

export interface Activity {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
  metadata?: any;
}

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

export interface SystemStats {
  leads: number;
  activities: number;
  agents: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  timestamp: string;
}
