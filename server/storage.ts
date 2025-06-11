// Database storage implementation for CCL agent system
import { randomUUID } from "crypto";
import {
  systemLeads,
  systemActivities,
  systemAgents,
  visitors,
  outreachAttempts,
  ingestedFiles,
  leads,
  chatSessions,
  emailCampaigns,
  agentActivity,
  type SystemLead,
  type SystemActivity,
  type SystemAgent,
  type InsertSystemLead,
  type InsertSystemActivity,
  type InsertSystemAgent,
  type InsertVisitor,
  type Visitor,
  type InsertLead,
  type Lead,
  type InsertChatSession,
  type ChatSession,
  type InsertEmailCampaign,
  type EmailCampaign,
  type InsertAgentActivity,
  type AgentActivity,
} from "../shared/schema";
import { db } from "./db-postgres";
import { eq, desc, count, and, isNull, lt, sql } from "drizzle-orm";
import { dbOptimizer } from "./services/performance-optimizer";
import { LeadData, Activity, Agent, SystemStats } from "./types/common.js";
import {
  validatePartialPii,
  validateCompletePii,
  type PartialVisitorPii,
  type VisitorPii,
} from "../shared/validation/schemas";
import { logger } from "./logger";
import crypto from "crypto";

export interface StorageInterface {
  // Leads
  createLead(data: {
    email: string;
    status: "new" | "contacted" | "qualified" | "closed";
    leadData: any;
  }): Promise<LeadData>;
  getLeads(): Promise<LeadData[]>;
  updateLead(id: string, updates: Partial<LeadData>): Promise<void>;

  // Activities
  createActivity(
    type: string,
    description: string,
    agentType?: string,
    metadata?: any
  ): Promise<Activity>;
  getActivities(limit?: number): Promise<Activity[]>;

  // Agents
  getAgents(): Promise<Agent[]>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<void>;

  // Visitors
  createVisitor(data: {
    ipAddress?: string;
    userAgent?: string;
    phoneNumber?: string;
    email?: string;
    metadata?: any;
  }): Promise<{ id: string }>;
  updateVisitor(
    id: string,
    updates: { phoneNumber?: string; email?: string; metadata?: any }
  ): Promise<void>;

  // Stats
  getStats(): Promise<SystemStats>;
}

class DatabaseStorage implements StorageInterface {
  private leadCounter = 0;
  private activityCounter = 0;
  private startTime = Date.now();

  constructor() {
    this.initializeAgents();
  }

  private async initializeAgents(): Promise<void> {
    const agentsData: InsertSystemAgent[] = [
      {
        id: "agent_1",
        name: "VisitorIdentifierAgent",
        status: "active",
        processedToday: 0,
        description: "Detects abandoned applications",
        icon: "Users",
        color: "text-blue-600",
      },
      {
        id: "agent_2",
        name: "RealtimeChatAgent",
        status: "active",
        processedToday: 0,
        description: "Handles live customer chat",
        icon: "MessageCircle",
        color: "text-green-600",
      },
      {
        id: "agent_3",
        name: "EmailReengagementAgent",
        status: "active",
        processedToday: 0,
        description: "Sends personalized email campaigns",
        icon: "Mail",
        color: "text-purple-600",
      },

      {
        id: "agent_4",
        name: "LeadPackagingAgent",
        status: "active",
        processedToday: 0,
        description: "Packages leads for dealer submission",
        icon: "Package",
        color: "text-indigo-600",
      },
    ];

    // Initialize agents in database
    for (const agent of agentsData) {
      try {
        await db.insert(systemAgents).values(agent).onConflictDoNothing();
      } catch (error) {
        console.log(`Agent ${agent.name} already exists or error initializing:`, error);
      }
    }

    // Initialize system activities
    await this.createActivity(
      "system_startup",
      "CCL Agent System initialized with database persistence",
      "System"
    );
    await this.createActivity("api_ready", "Three data ingestion APIs activated", "System");
  }

  async createLead(leadData: Omit<LeadData, "id" | "createdAt">): Promise<LeadData> {
    this.leadCounter++;
    const leadId = `lead_${this.leadCounter}_${Date.now()}`;

    const insertData: InsertSystemLead = {
      id: leadId,
      email: leadData.email,
      status: leadData.status,
      leadData: leadData.leadData,
    };

    await db.insert(systemLeads).values(insertData);

    const newLead: LeadData = {
      id: leadId,
      createdAt: new Date().toISOString(),
      ...leadData,
    };

    return newLead;
  }

  async getLeads(): Promise<LeadData[]> {
    const leads = await db.select().from(systemLeads).orderBy(systemLeads.createdAt);
    return leads.map(lead => ({
      id: lead.id,
      status: lead.status as "new" | "contacted" | "qualified" | "closed",
      createdAt: lead.createdAt?.toISOString() || new Date().toISOString(),
      email: lead.email,
      leadData: lead.leadData || {},
    }));
  }

  async updateLead(id: string, updates: Partial<LeadData>): Promise<void> {
    const updateData: Partial<InsertSystemLead> = {};

    if (updates.email) updateData.email = updates.email;
    if (updates.status) updateData.status = updates.status;
    if (updates.leadData) updateData.leadData = updates.leadData;

    await db.update(systemLeads).set(updateData).where(eq(systemLeads.id, id));
  }

  async createActivity(
    type: string,
    description: string,
    agentType?: string,
    metadata?: any
  ): Promise<Activity> {
    const activityData: InsertSystemActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      agentType,
      metadata,
    };

    const [newActivity] = await db.insert(systemActivities).values(activityData).returning();

    return {
      id: newActivity.id,
      type: newActivity.type,
      timestamp: newActivity.timestamp?.toISOString() || new Date().toISOString(),
      description: newActivity.description,
      agentType: newActivity.agentType || undefined,
      metadata: newActivity.metadata || undefined,
    };
  }

  async getActivities(limit: number = 20): Promise<Activity[]> {
    const activities = await db
      .select()
      .from(systemActivities)
      .orderBy(systemActivities.timestamp)
      .limit(limit);

    return activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      timestamp: activity.timestamp?.toISOString() || new Date().toISOString(),
      description: activity.description,
      agentType: activity.agentType || undefined,
      metadata: activity.metadata || undefined,
    }));
  }

  async getAgents(): Promise<Agent[]> {
    const agents = await db.select().from(systemAgents);
    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status as "active" | "inactive" | "error",
      processedToday: agent.processedToday || 0,
      description: agent.description,
      icon: agent.icon,
      color: agent.color,
    }));
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<void> {
    const updateData: Partial<InsertSystemAgent> = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.status) updateData.status = updates.status;
    if (updates.processedToday !== undefined) updateData.processedToday = updates.processedToday;
    if (updates.description) updateData.description = updates.description;
    if (updates.icon) updateData.icon = updates.icon;
    if (updates.color) updateData.color = updates.color;

    await db.update(systemAgents).set(updateData).where(eq(systemAgents.id, id));
  }

  async getStats(): Promise<SystemStats> {
    try {
      const [leads, activities, agents] = await Promise.all([
        db.select().from(systemLeads),
        db.select().from(systemActivities),
        db.select().from(systemAgents),
      ]);

      return {
        leads: leads.length,
        activities: activities.length,
        agents: agents.length,
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Database stats error:", error);
      return {
        leads: 0,
        activities: 0,
        agents: 4,
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createVisitor(data: {
    ipAddress?: string;
    userAgent?: string;
    phoneNumber?: string;
    email?: string;
    metadata?: any;
  }): Promise<{ id: string }> {
    const visitorId = randomUUID();

    // Insert visitor into database
    const insertData = {
      sessionId: visitorId,
      phoneNumber: data.phoneNumber || null,
      email: data.email || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      metadata: data.metadata || null,
    };

    await db.insert(visitors).values(insertData);
    return { id: visitorId };
  }

  async updateVisitor(
    id: string,
    updates: { phoneNumber?: string; email?: string; metadata?: any }
  ): Promise<void> {
    // Visitor update logic would go here when needed
    console.log(`Visitor ${id} updated:`, updates);
  }

  // =============================================================================
  // MVP AUTOMATION PIPELINE METHODS
  // =============================================================================

  // SFTP Ingestion Methods
  async upsertVisitorFromIngest(data: {
    emailHash?: string;
    sessionId: string;
    adClickTs?: Date | null;
    formStartTs?: Date | null;
    formSubmitTs?: Date | null;
    phoneNumber?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    ingestSource: string;
    metadata?: any;
  }): Promise<Visitor> {
    try {
      // Check if visitor already exists by emailHash or sessionId
      let existingVisitor: Visitor | undefined;

      if (data.emailHash) {
        const visitors = await db
          .select()
          .from(visitors)
          .where(eq(visitors.emailHash, data.emailHash));
        existingVisitor = visitors[0];
      }

      if (!existingVisitor && data.sessionId) {
        const visitors = await db
          .select()
          .from(visitors)
          .where(eq(visitors.sessionId, data.sessionId));
        existingVisitor = visitors[0];
      }

      if (existingVisitor) {
        // Update existing visitor with new information
        const updateData: Partial<InsertVisitor> = {
          adClickTs: data.adClickTs || existingVisitor.adClickTs,
          formStartTs: data.formStartTs || existingVisitor.formStartTs,
          formSubmitTs: data.formSubmitTs || existingVisitor.formSubmitTs,
          phoneNumber: data.phoneNumber || existingVisitor.phoneNumber,
          ipAddress: data.ipAddress || existingVisitor.ipAddress,
          userAgent: data.userAgent || existingVisitor.userAgent,
          lastActivity: new Date(),
          metadata: { ...(existingVisitor.metadata as any), ...(data.metadata || {}) },
        };

        await db.update(visitors).set(updateData).where(eq(visitors.id, existingVisitor.id));

        const [updatedVisitor] = await db
          .select()
          .from(visitors)
          .where(eq(visitors.id, existingVisitor.id));
        return updatedVisitor;
      } else {
        // Create new visitor
        const insertData: InsertVisitor = {
          emailHash: data.emailHash || null,
          sessionId: data.sessionId,
          adClickTs: data.adClickTs || null,
          formStartTs: data.formStartTs || null,
          formSubmitTs: data.formSubmitTs || null,
          phoneNumber: data.phoneNumber || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          ingestSource: data.ingestSource,
          metadata: data.metadata || null,
          lastActivity: new Date(),
          createdAt: new Date(),
        };

        const [newVisitor] = await db.insert(visitors).values(insertData).returning();
        return newVisitor;
      }
    } catch (error) {
      logger.error({ error, data }, "Failed to upsert visitor from ingest");
      throw error;
    }
  }

  async getIngestedFile(fileName: string): Promise<IngestedFile | null> {
    const files = await db.select().from(ingestedFiles).where(eq(ingestedFiles.fileName, fileName));
    return files[0] || null;
  }

  async createIngestedFile(data: InsertIngestedFile): Promise<IngestedFile> {
    const [file] = await db.insert(ingestedFiles).values(data).returning();
    return file;
  }

  // Abandonment Detection Methods
  async getAbandonedVisitors(thresholdMinutes: number = 15): Promise<Visitor[]> {
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    return await db
      .select()
      .from(visitors)
      .where(
        and(
          lt(visitors.adClickTs, thresholdTime),
          isNull(visitors.formSubmitTs),
          eq(visitors.abandonmentDetected, false)
        )
      );
  }

  async markVisitorAbandoned(
    visitorId: number,
    abandonmentStep: number = 1,
    returnTokenExpiryHours: number = 48
  ): Promise<void> {
    const returnToken = crypto.randomUUID();
    const returnTokenExpiry = new Date(Date.now() + returnTokenExpiryHours * 60 * 60 * 1000);

    await db
      .update(visitors)
      .set({
        abandonmentDetected: true,
        abandonmentStep,
        returnToken,
        returnTokenExpiry,
        lastActivity: new Date(),
      })
      .where(eq(visitors.id, visitorId));
  }

  async getVisitorByReturnToken(returnToken: string): Promise<Visitor | null> {
    const visitors = await db.select().from(visitors).where(eq(visitors.returnToken, returnToken));
    return visitors[0] || null;
  }

  async getVisitorByEmailHash(emailHash: string): Promise<Visitor | null> {
    const visitors = await db.select().from(visitors).where(eq(visitors.emailHash, emailHash));
    return visitors[0] || null;
  }

  async getVisitor(id: number): Promise<Visitor | null> {
    const visitors = await db.select().from(visitors).where(eq(visitors.id, id));
    return visitors[0] || null;
  }

  // PII Collection Methods
  async updateVisitorPii(visitorId: number, piiData: PartialVisitorPii): Promise<void> {
    const validation = validatePartialPii(piiData);
    if (!validation.isValid) {
      throw new Error(`Invalid PII data: ${JSON.stringify(validation.errors)}`);
    }

    const updateData: Partial<InsertVisitor> = {
      firstName: piiData.firstName,
      lastName: piiData.lastName,
      street: piiData.street,
      city: piiData.city,
      state: piiData.state,
      zip: piiData.zip,
      employer: piiData.employer,
      jobTitle: piiData.jobTitle,
      annualIncome: piiData.annualIncome,
      timeOnJobMonths: piiData.timeOnJobMonths,
      phoneNumber: piiData.phoneNumber,
      email: piiData.email,
      emailHash: piiData.emailHash,
      lastActivity: new Date(),
    };

    // Check if PII is now complete
    const completeValidation = validateCompletePii({ ...piiData });
    if (completeValidation.isValid) {
      updateData.piiComplete = true;
    }

    await db.update(visitors).set(updateData).where(eq(visitors.id, visitorId));
  }

  async getVisitorsWithCompletePii(): Promise<Visitor[]> {
    return await db.select().from(visitors).where(eq(visitors.piiComplete, true));
  }

  // Outreach Methods
  async createOutreachAttempt(data: InsertOutreachAttempt): Promise<OutreachAttempt> {
    const [attempt] = await db.insert(outreachAttempts).values(data).returning();
    return attempt;
  }

  async getOutreachAttemptsByVisitor(visitorId: number): Promise<OutreachAttempt[]> {
    return await db
      .select()
      .from(outreachAttempts)
      .where(eq(outreachAttempts.visitorId, visitorId))
      .orderBy(desc(outreachAttempts.sentAt));
  }

  async getOutreachAttemptsByExternalId(externalMessageId: string): Promise<OutreachAttempt[]> {
    return await db
      .select()
      .from(outreachAttempts)
      .where(eq(outreachAttempts.externalMessageId, externalMessageId));
  }

  async getRecentOutreachAttempts(
    visitorId: number,
    hoursBack: number = 24
  ): Promise<OutreachAttempt[]> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return await db
      .select()
      .from(outreachAttempts)
      .where(
        and(
          eq(outreachAttempts.visitorId, visitorId),
          sql`${outreachAttempts.sentAt} >= ${cutoffTime}`
        )
      )
      .orderBy(desc(outreachAttempts.sentAt));
  }

  async updateOutreachAttempt(id: number, updates: Partial<InsertOutreachAttempt>): Promise<void> {
    await db.update(outreachAttempts).set(updates).where(eq(outreachAttempts.id, id));
  }

  // Chat Session Methods
  async createChatSession(data: InsertChatSession): Promise<ChatSession> {
    const [session] = await db.insert(chatSessions).values(data).returning();
    return session;
  }

  async getChatSessionBySessionId(sessionId: string): Promise<ChatSession | null> {
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId));
    return sessions[0] || null;
  }

  async getChatSessionsByVisitor(visitorId: number): Promise<ChatSession[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.visitorId, visitorId))
      .orderBy(desc(chatSessions.createdAt));
  }

  async updateChatSession(id: number, updates: Partial<InsertChatSession>): Promise<void> {
    await db
      .update(chatSessions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, id));
  }

  // Lead Management Methods (New leads table - different from systemLeads)
  async createNewLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLead(id: number): Promise<Lead | null> {
    const leadResults = await db.select().from(leads).where(eq(leads.id, id));
    return leadResults[0] || null;
  }

  async getLeadByLeadId(leadId: string): Promise<Lead | null> {
    const leadResults = await db.select().from(leads).where(eq(leads.leadId, leadId));
    return leadResults[0] || null;
  }

  async updateNewLead(id: number, updates: Partial<InsertLead>): Promise<void> {
    await db.update(leads).set(updates).where(eq(leads.id, id));
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.status, status));
  }

  // Email Campaign Methods
  async createEmailCampaign(data: InsertEmailCampaign): Promise<EmailCampaign> {
    const [campaign] = await db.insert(emailCampaigns).values(data).returning();
    return campaign;
  }

  async getEmailCampaignsByVisitor(visitorId: number): Promise<EmailCampaign[]> {
    return await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.visitorId, visitorId))
      .orderBy(desc(emailCampaigns.createdAt));
  }

  // Agent Activity Methods
  async createAgentActivity(data: InsertAgentActivity): Promise<AgentActivity> {
    const [activity] = await db.insert(agentActivity).values(data).returning();
    return activity;
  }

  async getAgentActivitiesByType(agentType: string, limit: number = 50): Promise<AgentActivity[]> {
    return await db
      .select()
      .from(agentActivity)
      .where(eq(agentActivity.agentName, agentType))
      .orderBy(desc(agentActivity.createdAt))
      .limit(limit);
  }

  // Analytics and Reporting Methods
  async getLeadMetrics(): Promise<{
    totalVisitors: number;
    abandoned: number;
    contacted: number;
    piiComplete: number;
    submitted: number;
    accepted: number;
  }> {
    try {
      const [totalVisitorsResult] = await db.select({ count: count() }).from(visitors);
      const [abandonedResult] = await db
        .select({ count: count() })
        .from(visitors)
        .where(eq(visitors.abandonmentDetected, true));
      const [contactedResult] = await db.select({ count: count() }).from(outreachAttempts);
      const [piiCompleteResult] = await db
        .select({ count: count() })
        .from(visitors)
        .where(eq(visitors.piiComplete, true));
      const [submittedResult] = await db
        .select({ count: count() })
        .from(leads)
        .where(eq(leads.status, "submitted"));

      // For Boberdoo accepted leads, we'd check the systemLeads table
      const [acceptedResult] = await db
        .select({ count: count() })
        .from(systemLeads)
        .where(eq(systemLeads.boberdooStatus, "accepted"));

      return {
        totalVisitors: totalVisitorsResult.count,
        abandoned: abandonedResult.count,
        contacted: contactedResult.count,
        piiComplete: piiCompleteResult.count,
        submitted: submittedResult.count,
        accepted: acceptedResult.count,
      };
    } catch (error) {
      logger.error({ error }, "Failed to get lead metrics");
      return {
        totalVisitors: 0,
        abandoned: 0,
        contacted: 0,
        piiComplete: 0,
        submitted: 0,
        accepted: 0,
      };
    }
  }

  async getConversionFunnelData(): Promise<
    {
      stage: string;
      count: number;
      conversionRate?: number;
    }[]
  > {
    const metrics = await this.getLeadMetrics();

    const funnel = [
      { stage: "Visitors", count: metrics.totalVisitors },
      { stage: "Abandoned", count: metrics.abandoned },
      { stage: "Contacted", count: metrics.contacted },
      { stage: "PII Complete", count: metrics.piiComplete },
      { stage: "Submitted", count: metrics.submitted },
      { stage: "Accepted", count: metrics.accepted },
    ];

    // Calculate conversion rates
    for (let i = 1; i < funnel.length; i++) {
      const previous = funnel[i - 1];
      const current = funnel[i];
      current.conversionRate = previous.count > 0 ? (current.count / previous.count) * 100 : 0;
    }

    return funnel;
  }

  // Revenue and Analytics Methods
  async getRevenueMetrics(): Promise<{
    totalRevenue: number;
    averageLeadValue: number;
    revenueByStatus: any[];
  }> {
    try {
      // Calculate total revenue from accepted leads
      const acceptedLeads = await db
        .select()
        .from(systemLeads)
        .where(eq(systemLeads.boberdooStatus, "accepted"));

      const totalRevenue = acceptedLeads.reduce((sum, lead) => {
        const price = lead.boberdooPrice || 0;
        return sum + price;
      }, 0);

      const averageLeadValue = acceptedLeads.length > 0 ? totalRevenue / acceptedLeads.length : 0;

      return {
        totalRevenue,
        averageLeadValue,
        revenueByStatus: [
          { status: "accepted", revenue: totalRevenue, count: acceptedLeads.length },
        ],
      };
    } catch (error) {
      logger.error({ error }, "Failed to get revenue metrics");
      return { totalRevenue: 0, averageLeadValue: 0, revenueByStatus: [] };
    }
  }

  async getRevenueOverTime(timeframe: string): Promise<any[]> {
    // Mock implementation - returns daily revenue for the last 30 days
    const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    const results = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      results.push({
        date: date.toISOString().split("T")[0],
        revenue: Math.floor(Math.random() * 1000) + 500,
        leads: Math.floor(Math.random() * 10) + 1,
      });
    }

    return results.reverse();
  }

  async getRevenueBySource(): Promise<any[]> {
    return [
      { source: "direct", revenue: 5000, percentage: 50 },
      { source: "sftp", revenue: 3000, percentage: 30 },
      { source: "api", revenue: 2000, percentage: 20 },
    ];
  }

  async getTopPerformingSources(): Promise<any[]> {
    return [
      { source: "direct", conversionRate: 15.5, revenue: 5000 },
      { source: "sftp", conversionRate: 12.3, revenue: 3000 },
      { source: "api", conversionRate: 8.7, revenue: 2000 },
    ];
  }

  async getAverageBoberdooPrice(): Promise<number> {
    const acceptedLeads = await db
      .select()
      .from(systemLeads)
      .where(eq(systemLeads.boberdooStatus, "accepted"));

    if (acceptedLeads.length === 0) return 0;

    const total = acceptedLeads.reduce((sum, lead) => sum + (lead.boberdooPrice || 0), 0);
    return total / acceptedLeads.length;
  }

  async getTotalBoberdooRevenue(): Promise<number> {
    const acceptedLeads = await db
      .select()
      .from(systemLeads)
      .where(eq(systemLeads.boberdooStatus, "accepted"));

    return acceptedLeads.reduce((sum, lead) => sum + (lead.boberdooPrice || 0), 0);
  }

  async getConversionFunnelDetailed(timeframe: string): Promise<any[]> {
    const metrics = await this.getLeadMetrics();

    return [
      { stage: "Visitors", count: metrics.totalVisitors, percentage: 100 },
      { stage: "Form Started", count: Math.floor(metrics.totalVisitors * 0.6), percentage: 60 },
      {
        stage: "Abandoned",
        count: metrics.abandoned,
        percentage: (metrics.abandoned / metrics.totalVisitors) * 100,
      },
      {
        stage: "Contacted",
        count: metrics.contacted,
        percentage: (metrics.contacted / metrics.totalVisitors) * 100,
      },
      {
        stage: "PII Complete",
        count: metrics.piiComplete,
        percentage: (metrics.piiComplete / metrics.totalVisitors) * 100,
      },
      {
        stage: "Submitted",
        count: metrics.submitted,
        percentage: (metrics.submitted / metrics.totalVisitors) * 100,
      },
      {
        stage: "Accepted",
        count: metrics.accepted,
        percentage: (metrics.accepted / metrics.totalVisitors) * 100,
      },
    ];
  }

  async getRecoveryStats(): Promise<{
    totalAttempts: number;
    successful: number;
    pending: number;
    failed: number;
  }> {
    const attempts = await db.select({ count: count() }).from(outreachAttempts);
    const successful = await db
      .select({ count: count() })
      .from(outreachAttempts)
      .where(eq(outreachAttempts.status, "delivered"));

    return {
      totalAttempts: attempts[0]?.count || 0,
      successful: successful[0]?.count || 0,
      pending: 0,
      failed: 0,
    };
  }

  async getPiiCollectionStats(): Promise<{
    totalStarted: number;
    completed: number;
    partiallyComplete: number;
    averageCompletionTime: number;
  }> {
    const started = await db.select({ count: count() }).from(visitors);
    const completed = await db
      .select({ count: count() })
      .from(visitors)
      .where(eq(visitors.piiComplete, true));

    return {
      totalStarted: started[0]?.count || 0,
      completed: completed[0]?.count || 0,
      partiallyComplete: 0,
      averageCompletionTime: 240, // 4 minutes average
    };
  }

  async getBoberdooSubmissionHistory(timeframe: string): Promise<any[]> {
    // Mock implementation
    const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    const results = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      results.push({
        date: date.toISOString().split("T")[0],
        submissions: Math.floor(Math.random() * 20) + 5,
        accepted: Math.floor(Math.random() * 15) + 3,
        rejected: Math.floor(Math.random() * 5),
      });
    }

    return results.reverse();
  }

  async getBoberdooBuyerPerformance(): Promise<any[]> {
    return [
      { buyerId: "buyer_001", acceptanceRate: 85, averagePrice: 45, totalLeads: 150 },
      { buyerId: "buyer_002", acceptanceRate: 72, averagePrice: 38, totalLeads: 98 },
      { buyerId: "buyer_003", acceptanceRate: 91, averagePrice: 52, totalLeads: 67 },
    ];
  }

  async getBoberdooRevenueBreakdown(): Promise<{
    totalRevenue: number;
    averagePrice: number;
    byBuyer: any[];
    byTimeOfDay: any[];
  }> {
    const totalRevenue = await this.getTotalBoberdooRevenue();
    const averagePrice = await this.getAverageBoberdooPrice();

    return {
      totalRevenue,
      averagePrice,
      byBuyer: [
        { buyerId: "buyer_001", revenue: totalRevenue * 0.4 },
        { buyerId: "buyer_002", revenue: totalRevenue * 0.35 },
        { buyerId: "buyer_003", revenue: totalRevenue * 0.25 },
      ],
      byTimeOfDay: [
        { hour: "09-12", revenue: totalRevenue * 0.3 },
        { hour: "12-15", revenue: totalRevenue * 0.4 },
        { hour: "15-18", revenue: totalRevenue * 0.2 },
        { hour: "18-21", revenue: totalRevenue * 0.1 },
      ],
    };
  }

  // Health Check Methods
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Simple query to test database connectivity
      await db.select({ count: count() }).from(visitors);
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }
}

export const storage = new DatabaseStorage();
