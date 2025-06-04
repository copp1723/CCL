// Shared type definitions for the multi-agent system

export interface Metrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

export interface DetailedMetrics extends Metrics {
  failureRates: {
    overallErrorRate: number;
    emailFailureRate: number;
    creditCheckFailureRate: number;
    leadSubmissionFailureRate: number;
  };
  latencyMetrics: {
    avgChatResponseTime: number;
    p95ResponseTime: number;
    emailDeliveryTime: number;
    creditCheckTime: number;
  };
  throughput: {
    visitorEventsPerHour: number;
    emailsSentPerHour: number;
    leadsGeneratedPerHour: number;
  };
}

export interface AgentStatus {
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: Date;
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

export interface Activity {
  id: number;
  agentName: string;
  action: string;
  status: string;
  details: string | null;
  createdAt: Date;
  visitorId: number | null;
  leadId: number | null;
}

export interface Lead {
  id: number;
  visitorId: number;
  creditCheckId: number | null;
  leadData: unknown;
  status: string;
  dealerResponse: unknown;
  submittedAt: Date | null;
  createdAt: Date;
}