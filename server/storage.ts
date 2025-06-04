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

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private visitors: Map<number, Visitor> = new Map();
  private chatSessions: Map<number, ChatSession> = new Map();
  private emailCampaigns: Map<number, EmailCampaign> = new Map();
  private creditChecks: Map<number, CreditCheck> = new Map();
  private leadStorage: Map<number, Lead> = new Map();
  private agentActivities: Map<number, AgentActivity> = new Map();
  
  private currentUserId = 1;
  private currentVisitorId = 1;
  private currentChatSessionId = 1;
  private currentEmailCampaignId = 1;
  private currentCreditCheckId = 1;
  private currentLeadId = 1;
  private currentAgentActivityId = 1;

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
      lastActivity: insertVisitor.lastActivity || new Date(),
      abandonmentDetected: insertVisitor.abandonmentDetected || false,
      createdAt: new Date(),
    };
    this.visitors.set(id, visitor);
    return visitor;
  }

  async updateVisitor(id: number, updates: Partial<InsertVisitor>): Promise<Visitor> {
    const visitor = this.visitors.get(id);
    if (!visitor) {
      throw new Error(`Visitor ${id} not found`);
    }
    
    const updatedVisitor: Visitor = { ...visitor, ...updates };
    this.visitors.set(id, updatedVisitor);
    return updatedVisitor;
  }

  async getRecentActiveVisitors(): Promise<Visitor[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return Array.from(this.visitors.values())
      .filter(visitor => visitor.lastActivity > oneHourAgo)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  // Chat Sessions
  async getChatSession(id: number): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }

  async getChatSessionBySessionId(sessionId: string): Promise<ChatSession | undefined> {
    return Array.from(this.chatSessions.values()).find(session => session.sessionId === sessionId);
  }

  async getChatSessionsByVisitor(visitorId: number): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values()).filter(session => session.visitorId === visitorId);
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = this.currentChatSessionId++;
    const session: ChatSession = {
      ...insertSession,
      id,
      visitorId: insertSession.visitorId || null,
      isActive: insertSession.isActive ?? true,
      messages: insertSession.messages || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chatSessions.set(id, session);
    return session;
  }

  async updateChatSession(id: number, updates: Partial<InsertChatSession>): Promise<ChatSession> {
    const session = this.chatSessions.get(id);
    if (!session) {
      throw new Error(`Chat session ${id} not found`);
    }
    
    const updatedSession: ChatSession = { 
      ...session, 
      ...updates,
      updatedAt: new Date(),
    };
    this.chatSessions.set(id, updatedSession);
    return updatedSession;
  }

  // Email Campaigns
  async getEmailCampaign(id: number): Promise<EmailCampaign | undefined> {
    return this.emailCampaigns.get(id);
  }

  async getEmailCampaignByToken(token: string): Promise<EmailCampaign | undefined> {
    return Array.from(this.emailCampaigns.values()).find(campaign => campaign.returnToken === token);
  }

  async getEmailCampaignsByVisitor(visitorId: number): Promise<EmailCampaign[]> {
    return Array.from(this.emailCampaigns.values()).filter(campaign => campaign.visitorId === visitorId);
  }

  async createEmailCampaign(insertCampaign: InsertEmailCampaign): Promise<EmailCampaign> {
    const id = this.currentEmailCampaignId++;
    const campaign: EmailCampaign = {
      ...insertCampaign,
      id,
      emailSent: insertCampaign.emailSent ?? false,
      emailOpened: insertCampaign.emailOpened ?? false,
      clicked: insertCampaign.clicked ?? false,
      createdAt: new Date(),
    };
    this.emailCampaigns.set(id, campaign);
    return campaign;
  }

  async updateEmailCampaign(id: number, updates: Partial<InsertEmailCampaign>): Promise<EmailCampaign> {
    const campaign = this.emailCampaigns.get(id);
    if (!campaign) {
      throw new Error(`Email campaign ${id} not found`);
    }
    
    const updatedCampaign: EmailCampaign = { ...campaign, ...updates };
    this.emailCampaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  // Credit Checks
  async getCreditCheck(id: number): Promise<CreditCheck | undefined> {
    return this.creditChecks.get(id);
  }

  async getCreditCheckByVisitorId(visitorId: number): Promise<CreditCheck | undefined> {
    return Array.from(this.creditChecks.values())
      .find(check => check.visitorId === visitorId);
  }

  async createCreditCheck(insertCreditCheck: InsertCreditCheck): Promise<CreditCheck> {
    const id = this.currentCreditCheckId++;
    const creditCheck: CreditCheck = {
      ...insertCreditCheck,
      id,
      creditScore: insertCreditCheck.creditScore || null,
      approved: insertCreditCheck.approved ?? false,
      externalId: insertCreditCheck.externalId || null,
      createdAt: new Date(),
    };
    this.creditChecks.set(id, creditCheck);
    return creditCheck;
  }

  // Leads
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leadStorage.get(id);
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return Array.from(this.leadStorage.values()).filter(lead => lead.status === status);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = this.currentLeadId++;
    const lead: Lead = {
      ...insertLead,
      id,
      status: insertLead.status || 'pending',
      creditCheckId: insertLead.creditCheckId || null,
      dealerResponse: insertLead.dealerResponse || null,
      submittedAt: insertLead.submittedAt || null,
      createdAt: new Date(),
    };
    this.leadStorage.set(id, lead);
    return lead;
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    const lead = this.leadStorage.get(id);
    if (!lead) {
      throw new Error(`Lead ${id} not found`);
    }
    
    const updatedLead: Lead = { ...lead, ...updates };
    this.leadStorage.set(id, updatedLead);
    return updatedLead;
  }

  // Agent Activity
  async createAgentActivity(insertActivity: InsertAgentActivity): Promise<AgentActivity> {
    const id = this.currentAgentActivityId++;
    const activity: AgentActivity = {
      ...insertActivity,
      id,
      visitorId: insertActivity.visitorId || null,
      details: insertActivity.details || null,
      leadId: insertActivity.leadId || null,
      createdAt: new Date(),
    };
    this.agentActivities.set(id, activity);
    return activity;
  }

  async getRecentAgentActivity(limit: number = 50): Promise<AgentActivity[]> {
    return Array.from(this.agentActivities.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getAgentActivityByAgent(agentName: string, limit: number = 50): Promise<AgentActivity[]> {
    return Array.from(this.agentActivities.values())
      .filter(activity => activity.agentName === agentName)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
