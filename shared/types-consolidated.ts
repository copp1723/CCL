/**
 * Consolidated type definitions for Complete Car Loans Agent System
 * Replaces: types.ts, types-simplified.ts, and parts of api-types.ts
 */

// ============================================================================
// CORE SYSTEM TYPES
// ============================================================================

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

// ============================================================================
// AGENT TYPES
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: Date;
  processedToday: number;
  description: string;
  icon: string;
  color: string;
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

// ============================================================================
// LEAD TYPES
// ============================================================================

export interface LeadDetails {
  vehicleInterest?: string;
  creditScore?: number;
  annualIncome?: number;
  loanAmount?: number;
  firstName?: string;
  lastName?: string;
  zipCode?: string;
}

export interface LeadData {
  id: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  email: string;
  leadData: LeadDetails;
}

export interface Lead {
  id: string; // Changed from number to string to match storage implementation
  visitorId?: string; // Changed to optional string to match storage
  creditCheckId?: string | null; // Changed to optional string
  leadData: LeadDetails; // Changed from unknown to specific type
  status: 'new' | 'contacted' | 'qualified' | 'closed'; // More specific type
  dealerResponse?: Record<string, unknown>; // Changed to optional
  submittedAt?: Date | null; // Made optional
  createdAt: Date;
  updatedAt?: Date; // Added to match database schema
  email: string; // Added required fields from storage
  phoneNumber?: string; // Added optional phone number
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface Activity {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
  metadata?: any;
}

// ============================================================================
// EMAIL CAMPAIGN TYPES
// ============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  variables: string[];
  category: 'welcome' | 'follow-up' | 'reengagement' | 'promotional';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  templateId: string;
  recipients: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduledAt?: string;
  sentAt?: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// VISITOR TYPES
// ============================================================================

export interface Visitor {
  id: string; // Changed from number to string to match storage implementation
  sessionId: string;
  phoneNumber?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  returnToken?: string;
  returnTokenExpiry?: Date;
  abandonmentStep: number;
  lastActivity: Date;
  abandonmentDetected: boolean;
  createdAt: Date;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface ChatSession {
  id: string;
  sessionId: string;
  visitorId?: string; // Changed from number to string to match Visitor interface
  isActive: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

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

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Status = 'active' | 'inactive' | 'error' | 'pending';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
export type AgentType = 'visitor_identifier' | 'chat' | 'email_reengagement' | 'lead_packaging';
