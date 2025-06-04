// Simplified types for CCL agent system
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
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  timestamp: string;
}

export interface Metrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

export interface EmailCampaignSettings {
  timing: {
    step1Delay: number;
    step2Delay: number;
    step3Delay: number;
  };
  mailgun?: {
    domain: string;
    status: string;
  };
}

export interface EmailCampaign {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}