import { 
  users, visitors, leads, chatSessions, chatMessages, emailCampaigns, agentActivity,
  type User, type InsertUser,
  type Visitor, type InsertVisitor,
  type Lead, type InsertLead,
  type ChatSession, type InsertChatSession,
  type ChatMessage, type InsertChatMessage,
  type EmailCampaign, type InsertEmailCampaign,
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
  updateVisitor(id: number, updates: Partial<Visitor>): Promise<Visitor | undefined>;
  getAbandonedVisitors(): Promise<Visitor[]>;

  // Leads
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined>;
  getRecentLeads(limit?: number): Promise<Lead[]>;

  // Chat Sessions
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  getActiveChatSessions(): Promise<ChatSession[]>;

  // Chat Messages
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Email Campaigns
  getEmailCampaign(id: number): Promise<EmailCampaign | undefined>;
  getEmailCampaignByToken(token: string): Promise<EmailCampaign | undefined>;
  createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign>;
  updateEmailCampaign(id: number, updates: Partial<EmailCampaign>): Promise<EmailCampaign | undefined>;

  // Agent Activity
  createAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity>;
  getRecentAgentActivity(limit?: number): Promise<AgentActivity[]>;
  getAgentActivityByType(agentName: string): Promise<AgentActivity[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private visitors: Map<number, Visitor>;
  private leads: Map<number, Lead>;
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage[]>;
  private emailCampaigns: Map<number, EmailCampaign>;
  private agentActivities: AgentActivity[];
  private currentUserId: number;
  private currentVisitorId: number;
  private currentLeadId: number;
  private currentChatMessageId: number;
  private currentEmailCampaignId: number;
  private currentAgentActivityId: number;

  constructor() {
    this.users = new Map();
    this.visitors = new Map();
    this.leads = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.emailCampaigns = new Map();
    this.agentActivities = [];
    this.currentUserId = 1;
    this.currentVisitorId = 1;
    this.currentLeadId = 1;
    this.currentChatMessageId = 1;
    this.currentEmailCampaignId = 1;
    this.currentAgentActivityId = 1;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Visitors
  async getVisitor(id: number): Promise<Visitor | undefined> {
    return this.visitors.get(id);
  }

  async getVisitorByEmailHash(emailHash: string): Promise<Visitor | undefined> {
    return Array.from(this.visitors.values()).find(visitor => visitor.emailHash === emailHash);
  }

  async getVisitorBySessionId(sessionId: string): Promise<Visitor | undefined> {
    return Array.from(this.visitors.values()).find(visitor => visitor.sessionId === sessionId);
  }

  async createVisitor(insertVisitor: InsertVisitor): Promise<Visitor> {
    const id = this.currentVisitorId++;
    const visitor: Visitor = { 
      ...insertVisitor, 
      id,
      createdAt: new Date()
    };
    this.visitors.set(id, visitor);
    return visitor;
  }

  async updateVisitor(id: number, updates: Partial<Visitor>): Promise<Visitor | undefined> {
    const visitor = this.visitors.get(id);
    if (!visitor) return undefined;
    
    const updatedVisitor = { ...visitor, ...updates };
    this.visitors.set(id, updatedVisitor);
    return updatedVisitor;
  }

  async getAbandonedVisitors(): Promise<Visitor[]> {
    return Array.from(this.visitors.values()).filter(visitor => visitor.isAbandoned);
  }

  // Leads
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return Array.from(this.leads.values()).filter(lead => lead.status === status);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = this.currentLeadId++;
    const lead: Lead = { 
      ...insertLead, 
      id,
      createdAt: new Date()
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updatedLead = { ...lead, ...updates };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  async getRecentLeads(limit: number = 10): Promise<Lead[]> {
    return Array.from(this.leads.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  // Chat Sessions
  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(sessionId);
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = Math.floor(Math.random() * 100000);
    const session: ChatSession = { 
      ...insertSession, 
      id,
      createdAt: new Date()
    };
    this.chatSessions.set(insertSession.sessionId, session);
    this.chatMessages.set(insertSession.sessionId, []);
    return session;
  }

  async updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(sessionId);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.chatSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async getActiveChatSessions(): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(session => session.isActive);
  }

  // Chat Messages
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(sessionId) || [];
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentChatMessageId++;
    const message: ChatMessage = { 
      ...insertMessage, 
      id,
      timestamp: new Date()
    };
    
    const messages = this.chatMessages.get(insertMessage.sessionId) || [];
    messages.push(message);
    this.chatMessages.set(insertMessage.sessionId, messages);
    
    // Update session last message time
    const session = this.chatSessions.get(insertMessage.sessionId);
    if (session) {
      await this.updateChatSession(insertMessage.sessionId, { lastMessageAt: new Date() });
    }
    
    return message;
  }

  // Email Campaigns
  async getEmailCampaign(id: number): Promise<EmailCampaign | undefined> {
    return this.emailCampaigns.get(id);
  }

  async getEmailCampaignByToken(token: string): Promise<EmailCampaign | undefined> {
    return Array.from(this.emailCampaigns.values()).find(campaign => campaign.returnToken === token);
  }

  async createEmailCampaign(insertCampaign: InsertEmailCampaign): Promise<EmailCampaign> {
    const id = this.currentEmailCampaignId++;
    const campaign: EmailCampaign = { 
      ...insertCampaign, 
      id,
      createdAt: new Date()
    };
    this.emailCampaigns.set(id, campaign);
    return campaign;
  }

  async updateEmailCampaign(id: number, updates: Partial<EmailCampaign>): Promise<EmailCampaign | undefined> {
    const campaign = this.emailCampaigns.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = { ...campaign, ...updates };
    this.emailCampaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  // Agent Activity
  async createAgentActivity(insertActivity: InsertAgentActivity): Promise<AgentActivity> {
    const id = this.currentAgentActivityId++;
    const activity: AgentActivity = { 
      ...insertActivity, 
      id,
      timestamp: new Date()
    };
    this.agentActivities.unshift(activity); // Add to beginning for recent first
    return activity;
  }

  async getRecentAgentActivity(limit: number = 20): Promise<AgentActivity[]> {
    return this.agentActivities.slice(0, limit);
  }

  async getAgentActivityByType(agentName: string): Promise<AgentActivity[]> {
    return this.agentActivities.filter(activity => activity.agentName === agentName);
  }
}

export const storage = new MemStorage();
