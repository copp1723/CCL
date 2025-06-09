// API Response Types for Client-Server Communication

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Agent API Response Types
export interface AgentStatusResponse {
  id: string;
  name: string;
  status: "active" | "inactive" | "error";
  lastActivity: string;
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

export interface ActivityResponse {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
  metadata?: any;
}

// Lead API Response Types
export interface LeadResponse {
  id: string;
  status: "new" | "contacted" | "qualified" | "closed";
  createdAt: string;
  email: string;
  leadData: any;
}

export interface LeadProcessingResponse extends ApiResponse<LeadResponse> {
  creditCheckId?: string;
  nextSteps?: string[];
}

// Email Campaign API Response Types
export interface EmailCampaignResponse {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}

export interface EmailCampaignSettingsResponse {
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

export interface BulkEmailSendResponse extends ApiResponse {
  campaignId: string;
  processed: number;
  scheduled: number;
  errors: string[];
}

// Metrics API Response Types
export interface MetricsResponse {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

export interface SystemStatsResponse {
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

// Credit Check API Response Types
export interface CreditCheckResponse {
  approved: boolean;
  creditScore?: number;
  riskTier: "prime" | "near-prime" | "sub-prime" | "deep-sub-prime";
  maxLoanAmount?: number;
  estimatedRate?: number;
  externalId: string;
  reasons?: string[];
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: "agent_update" | "new_activity" | "system_alert" | "chat_message";
  data: any;
  timestamp: string;
}

// Error Response Types
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// Request Types
export interface BulkEmailSendRequest {
  csvData: string;
  campaignName: string;
  scheduleType: "immediate" | "delayed";
  timingSettings?: {
    step1Delay: number;
    step2Delay: number;
    step3Delay: number;
  };
}

export interface LeadProcessingRequest {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  metadata?: any;
}

export interface EmailCampaignSettingsRequest {
  timing: {
    step1Delay: number;
    step2Delay: number;
    step3Delay: number;
  };
  templates?: any;
}

export interface ChatMessageRequest {
  message: string;
  visitorId?: string;
  sessionId?: string;
}

export interface ChatMessageResponse {
  response: string;
  shouldHandoff?: boolean;
  nextAgent?: string;
  metadata?: any;
}
