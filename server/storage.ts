import { 
  users, visitors, chatSessions, emailCampaigns, creditChecks, leads, agentActivity,
  type User, type InsertUser, type Visitor, type InsertVisitor,
  type ChatSession, type InsertChatSession, type EmailCampaign, type InsertEmailCampaign,
  type CreditCheck, type InsertCreditCheck, type Lead, type InsertLead,
  type AgentActivity, type InsertAgentActivity
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Visitors
  getVisitor(id: number): Promise<Visitor | undefined>;
  getVisitorByEmailHash(emailHash: string): Promise<Visitor | undefined>;
  getVisitorBySessionId(sessionId: string): Promise<Visitor | undefined>;
  createVisitor(visitor: InsertVisitor): Promise<Visitor>;
  updateVisitor(id: number, updates: Partial<InsertVisitor>): Promise<Visitor>;
  getRecentActiveVisitors(): Promise<Visitor[]>;

  // Chat Sessions
  getChatSession(id: number): Promise<ChatSession | undefined>;
  getChatSessionBySessionId(sessionId: string): Promise<ChatSession | undefined>;
  getChatSessionsByVisitor(visitorId: number): Promise<ChatSession[]>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  updateChatSession(id: number, updates: Partial<InsertChatSession>): Promise<ChatSession>;

  // Email Campaigns
  getEmailCampaign(id: number): Promise<EmailCampaign | undefined>;
  getEmailCampaignByToken(token: string): Promise<EmailCampaign | undefined>;
  getEmailCampaignsByVisitor(visitorId: number): Promise<EmailCampaign[]>;
  createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign>;
  updateEmailCampaign(id: number, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign>;

  // Credit Checks
  getCreditCheck(id: number): Promise<CreditCheck | undefined>;
  getCreditCheckByVisitorId(visitorId: number): Promise<CreditCheck | undefined>;
  createCreditCheck(creditCheck: InsertCreditCheck): Promise<CreditCheck>;

  // Leads
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead>;

  // Agent Activity
  createAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity>;
  getRecentAgentActivity(limit?: number): Promise<AgentActivity[]>;
  getAgentActivityByAgent(agentName: string, limit?: number): Promise<AgentActivity[]>;
}

import { ErrorLogger, AppError } from './utils/errorHandler';

// In-memory storage for development
// In production, this would be replaced with a proper database

interface Lead {
  id: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  updatedAt: string;
  email: string;
  leadData: any;
}

interface Activity {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
  metadata?: any;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: string;
}

class SafeStorage {
  private leads: Map<string, Lead> = new Map();
  private activities: Map<string, Activity> = new Map();
  private agents: Map<string, Agent> = new Map();
  private maxLeads = 10000; // Prevent memory overflow
  private maxActivities = 5000;

  // Validation helpers
  private validateLead(lead: Partial<Lead>): void {
    if (!lead.id || typeof lead.id !== 'string') {
      throw new AppError('Lead ID is required and must be a string', 400);
    }
    if (!lead.email || typeof lead.email !== 'string') {
      throw new AppError('Lead email is required and must be a string', 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(lead.email)) {
      throw new AppError('Invalid email format', 400);
    }
    if (lead.status && !['new', 'contacted', 'qualified', 'closed'].includes(lead.status)) {
      throw new AppError('Invalid lead status', 400);
    }
  }

  private validateActivity(activity: Partial<Activity>): void {
    if (!activity.id || typeof activity.id !== 'string') {
      throw new AppError('Activity ID is required and must be a string', 400);
    }
    if (!activity.type || typeof activity.type !== 'string') {
      throw new AppError('Activity type is required and must be a string', 400);
    }
    if (!activity.description || typeof activity.description !== 'string') {
      throw new AppError('Activity description is required and must be a string', 400);
    }
  }

  // Leads methods
  leads = {
    getAll: (): Lead[] => {
      try {
        return Array.from(this.leads.values()).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } catch (error) {
        console.warn('Error retrieving leads:', (error as Error).message);
        return [];
      }
    },

    getById: (id: string): Lead | null => {
      try {
        if (!id || typeof id !== 'string') {
          throw new AppError('Lead ID is required and must be a string', 400);
        }
        return this.leads.get(id) || null;
      } catch (error) {
        ErrorLogger.logWarning(`Error retrieving lead ${id}`, {
          operation: 'storage_get_lead_by_id',
          metadata: { leadId: id, error: (error as Error).message }
        });
        return null;
      }
    },

    create: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead => {
      try {
        if (this.leads.size >= this.maxLeads) {
          // Remove oldest leads if at capacity
          const oldestLeads = Array.from(this.leads.values())
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .slice(0, 100);

          oldestLeads.forEach(oldLead => this.leads.delete(oldLead.id));
          ErrorLogger.logWarning('Removed old leads due to capacity limit', {
            operation: 'storage_cleanup_leads',
            metadata: { removedCount: oldestLeads.length }
          });
        }

        const newLead: Lead = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...lead,
          status: lead.status || 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        this.validateLead(newLead);
        this.leads.set(newLead.id, newLead);

        ErrorLogger.logInfo('Lead created successfully', {
          operation: 'storage_create_lead',
          metadata: { leadId: newLead.id, email: newLead.email }
        });

        return newLead;
      } catch (error) {
        if (error instanceof AppError) throw error;
        ErrorLogger.logError(error as Error, {
          operation: 'storage_create_lead',
          metadata: { email: lead.email }
        });
        throw new AppError('Failed to create lead', 500);
      }
    },

    update: (id: string, updates: Partial<Lead>): Lead | null => {
      try {
        if (!id || typeof id !== 'string') {
          throw new AppError('Lead ID is required and must be a string', 400);
        }

        const existingLead = this.leads.get(id);
        if (!existingLead) {
          throw new AppError('Lead not found', 404);
        }

        const updatedLead: Lead = {
          ...existingLead,
          ...updates,
          id: existingLead.id, // Prevent ID changes
          createdAt: existingLead.createdAt, // Prevent creation date changes
          updatedAt: new Date().toISOString()
        };

        this.validateLead(updatedLead);
        this.leads.set(id, updatedLead);

        ErrorLogger.logInfo('Lead updated successfully', {
          operation: 'storage_update_lead',
          metadata: { leadId: id }
        });

        return updatedLead;
      } catch (error) {
        if (error instanceof AppError) throw error;
        ErrorLogger.logError(error as Error, {
          operation: 'storage_update_lead',
          metadata: { leadId: id }
        });
        return null;
      }
    },

    delete: (id: string): boolean => {
      try {
        if (!id || typeof id !== 'string') {
          throw new AppError('Lead ID is required and must be a string', 400);
        }

        const success = this.leads.delete(id);
        if (success) {
          ErrorLogger.logInfo('Lead deleted successfully', {
            operation: 'storage_delete_lead',
            metadata: { leadId: id }
          });
        }
        return success;
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          operation: 'storage_delete_lead',
          metadata: { leadId: id }
        });
        return false;
      }
    }
  };

  // Activities methods
  activities = {
    getAll: (): Activity[] => {
      try {
        return Array.from(this.activities.values()).sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      } catch (error) {
        ErrorLogger.logWarning('Error retrieving activities', {
          operation: 'storage_get_activities',
          metadata: { error: (error as Error).message }
        });
        return [];
      }
    },

    create: (activity: Omit<Activity, 'id' | 'timestamp'>): Activity => {
      try {
        if (this.activities.size >= this.maxActivities) {
          // Remove oldest activities if at capacity
          const oldestActivities = Array.from(this.activities.values())
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(0, 500);

          oldestActivities.forEach(oldActivity => this.activities.delete(oldActivity.id));
          ErrorLogger.logInfo('Removed old activities due to capacity limit', {
            operation: 'storage_cleanup_activities',
            metadata: { removedCount: oldestActivities.length }
          });
        }

        const newActivity: Activity = {
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...activity,
          timestamp: new Date().toISOString()
        };

        this.validateActivity(newActivity);
        this.activities.set(newActivity.id, newActivity);

        return newActivity;
      } catch (error) {
        if (error instanceof AppError) throw error;
        ErrorLogger.logError(error as Error, {
          operation: 'storage_create_activity',
          metadata: { type: activity.type }
        });
        throw new AppError('Failed to create activity', 500);
      }
    }
  };

  // Agents methods
  agents = {
    getAll: (): Agent[] => {
      return Array.from(this.agents.values());
    },

    getActiveCount: (): number => {
      return Array.from(this.agents.values()).filter(agent => agent.status === 'active').length;
    },

    updateStatus: (name: string, status: Agent['status']): void => {
      try {
        const agent = this.agents.get(name) || {
          id: name,
          name,
          type: 'unknown',
          status: 'inactive',
          lastActivity: new Date().toISOString()
        };

        this.agents.set(name, {
          ...agent,
          status,
          lastActivity: new Date().toISOString()
        });
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          operation: 'storage_update_agent_status',
          metadata: { agentName: name, status }
        });
      }
    }
  };

  // Cleanup methods
  cleanup = {
    old: (days: number = 30): void => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Cleanup old leads
        const oldLeads = Array.from(this.leads.values()).filter(lead => 
          new Date(lead.createdAt) < cutoffDate
        );
        oldLeads.forEach(lead => this.leads.delete(lead.id));

        // Cleanup old activities
        const oldActivities = Array.from(this.activities.values()).filter(activity => 
          new Date(activity.timestamp) < cutoffDate
        );
        oldActivities.forEach(activity => this.activities.delete(activity.id));

        ErrorLogger.logInfo('Cleanup completed', {
          operation: 'storage_cleanup',
          metadata: { 
            removedLeads: oldLeads.length, 
            removedActivities: oldActivities.length,
            cutoffDays: days
          }
        });
      } catch (error) {
        ErrorLogger.logError(error as Error, {
          operation: 'storage_cleanup',
          metadata: { days }
        });
      }
    }
  };

  // Get storage statistics
  getStats() {
    return {
      leads: this.leads.size,
      activities: this.activities.size,
      agents: this.agents.size,
      maxLeads: this.maxLeads,
      maxActivities: this.maxActivities
    };
  }
}

// Initialize with some sample data for development
const createSampleData = (storage: SafeStorage) => {
  try {
    // Create sample leads
    const sampleLeads = [
      {
        email: 'john.doe@example.com',
        leadData: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '555-0123',
          creditAssessment: { approved: true, score: 720 },
          metadata: { priority: 'high', source: 'website' }
        }
      },
      {
        email: 'jane.smith@example.com',
        leadData: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '555-0124',
          creditAssessment: { approved: true, score: 680 },
          metadata: { priority: 'medium', source: 'referral' }
        }
      }
    ];

    sampleLeads.forEach(lead => {
      try {
        storage.leads.create(lead);
      } catch (error) {
        ErrorLogger.logWarning('Failed to create sample lead', {
          operation: 'storage_sample_data',
          metadata: { email: lead.email, error: (error as Error).message }
        });
      }
    });

    // Create sample activities
    const sampleActivities = [
      {
        type: 'lead_created',
        description: 'New lead generated from website visitor',
        agentType: 'VisitorIdentifierAgent',
        metadata: { source: 'website' }
      },
      {
        type: 'email_sent',
        description: 'Re-engagement email sent to qualified lead',
        agentType: 'EmailReengagementAgent',
        metadata: { template: 'reengagement_v1' }
      },
      {
        type: 'credit_check',
        description: 'Soft credit check completed',
        agentType: 'CreditCheckAgent',
        metadata: { score: 720, approved: true }
      }
    ];

    sampleActivities.forEach(activity => {
      try {
        storage.activities.create(activity);
      } catch (error) {
        ErrorLogger.logWarning('Failed to create sample activity', {
          operation: 'storage_sample_data',
          metadata: { type: activity.type, error: (error as Error).message }
        });
      }
    });

    ErrorLogger.logInfo('Sample data created successfully');
  } catch (error) {
    ErrorLogger.logError(error as Error, {
      operation: 'storage_sample_data_creation'
    });
  }
};

export const storage = new SafeStorage();

// Initialize sample data in development
if (process.env.NODE_ENV === 'development') {
  createSampleData(storage);
}

// Cleanup old data every hour
setInterval(() => {
  storage.cleanup.old(7); // Keep data for 7 days in development
}, 60 * 60 * 1000);