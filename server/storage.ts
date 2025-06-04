import { 
  InsertUser, User, InsertVisitor, Visitor, InsertChatSession, ChatSession,
  InsertEmailCampaign, EmailCampaign, InsertCreditCheck, CreditCheck,
  InsertLead, Lead, InsertAgentActivity, AgentActivity
} from "../shared/schema";

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

// Simplified interfaces for flexible data ingestion
interface SimpleLeadData {
  id: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  updatedAt: string;
  email: string;
  leadData: any;
}

interface SimpleActivity {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
  metadata?: any;
}

interface SimpleAgent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: string;
}

class FlexibleStorage {
  private leadCounter = 0;
  private activityCounter = 0;
  private leadStore: SimpleLeadData[] = [];
  private activityStore: SimpleActivity[] = [];
  private agentStore: SimpleAgent[] = [];
  
  private readonly maxLeads = 10000;
  private readonly maxActivities = 5000;

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Initialize with active agent statuses
    this.agentStore = [
      {
        id: "agent_1",
        name: "VisitorIdentifierAgent",
        type: "identifier",
        status: "active",
        lastActivity: new Date().toISOString()
      },
      {
        id: "agent_2", 
        name: "RealtimeChatAgent",
        type: "chat",
        status: "active",
        lastActivity: new Date().toISOString()
      },
      {
        id: "agent_3",
        name: "EmailReengagementAgent", 
        type: "email",
        status: "active",
        lastActivity: new Date().toISOString()
      },
      {
        id: "agent_4",
        name: "CreditCheckAgent",
        type: "credit", 
        status: "active",
        lastActivity: new Date().toISOString()
      },
      {
        id: "agent_5",
        name: "LeadPackagingAgent",
        type: "packaging",
        status: "active", 
        lastActivity: new Date().toISOString()
      }
    ];

    // Add some sample activities
    this.createActivity({
      type: "system_startup",
      description: "CCL Agent System initialized with Mailgun integration",
      agentType: "System"
    });

    this.createActivity({
      type: "api_ready", 
      description: "Three data ingestion APIs activated",
      agentType: "System"
    });
  }

  // Lead methods for flexible data ingestion
  leads = {
    getAll: (): SimpleLeadData[] => {
      return [...this.leadStore].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },

    getById: (id: string): SimpleLeadData | null => {
      return this.leadStore.find(lead => lead.id === id) || null;
    },

    create: (leadData: Omit<SimpleLeadData, 'id' | 'createdAt' | 'updatedAt'>): SimpleLeadData => {
      if (this.leadStore.length >= this.maxLeads) {
        this.leadStore = this.leadStore.slice(-5000); // Keep latest 5000
      }

      const newLead: SimpleLeadData = {
        id: `lead_${++this.leadCounter}_${Date.now()}`,
        ...leadData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.leadStore.push(newLead);
      return newLead;
    },

    update: (id: string, updates: Partial<SimpleLeadData>): SimpleLeadData | null => {
      const index = this.leadStore.findIndex(lead => lead.id === id);
      if (index === -1) return null;

      this.leadStore[index] = {
        ...this.leadStore[index],
        ...updates,
        id: this.leadStore[index].id, // Preserve ID
        createdAt: this.leadStore[index].createdAt, // Preserve creation date
        updatedAt: new Date().toISOString()
      };

      return this.leadStore[index];
    }
  };

  // Activity methods for tracking data ingestion
  activities = {
    getAll: (): SimpleActivity[] => {
      return [...this.activityStore].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },

    create: (activityData: Omit<SimpleActivity, 'id' | 'timestamp'>): SimpleActivity => {
      if (this.activityStore.length >= this.maxActivities) {
        this.activityStore = this.activityStore.slice(-2000); // Keep latest 2000
      }

      const newActivity: SimpleActivity = {
        id: `activity_${++this.activityCounter}_${Date.now()}`,
        ...activityData,
        timestamp: new Date().toISOString()
      };

      this.activityStore.push(newActivity);
      return newActivity;
    }
  };

  private createActivity = this.activities.create;

  // Agent status methods
  agents = {
    getAll: (): SimpleAgent[] => {
      return [...this.agentStore];
    },

    updateStatus: (agentName: string, status: 'active' | 'inactive' | 'error') => {
      const agent = this.agentStore.find(a => a.name === agentName);
      if (agent) {
        agent.status = status;
        agent.lastActivity = new Date().toISOString();
      }
    }
  };

  // System statistics
  getStats() {
    return {
      leads: this.leadStore.length,
      activities: this.activityStore.length,
      agents: this.agentStore.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup methods
  cleanup = {
    removeOldLeads: (daysOld: number = 30) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const originalCount = this.leadStore.length;
      this.leadStore = this.leadStore.filter(lead => 
        new Date(lead.createdAt) > cutoffDate
      );
      
      return originalCount - this.leadStore.length;
    },

    removeOldActivities: (daysOld: number = 7) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const originalCount = this.activityStore.length;
      this.activityStore = this.activityStore.filter(activity => 
        new Date(activity.timestamp) > cutoffDate
      );
      
      return originalCount - this.activityStore.length;
    }
  };
}

export const storage = new FlexibleStorage();

console.log("Flexible storage system initialized for data ingestion APIs");
console.log(`Initial stats: ${JSON.stringify(storage.getStats(), null, 2)}`);