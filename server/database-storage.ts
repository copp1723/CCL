import { db } from "./db-postgres.js";
import { systemLeads, systemActivities, systemAgents } from "../shared/schema.js";
import { desc, eq } from "drizzle-orm";

// Database storage implementation using PostgreSQL
export const storage = {
  async createLead(data: any) {
    const leadId = `lead_${Date.now()}`;
    const lead = {
      id: leadId,
      email: data.email,
      status: data.status || "new",
      leadData: data,
    };

    const [inserted] = await db.insert(systemLeads).values(lead).returning();

    // Auto-create activity
    await this.createActivity("lead_created", `New lead added: ${data.email}`, "data-ingestion", {
      email: data.email,
      source: "csv_upload",
    });

    return inserted;
  },

  async getLeads() {
    return await db.select().from(systemLeads).orderBy(desc(systemLeads.createdAt));
  },

  async getActivities(limit = 20) {
    return await db
      .select()
      .from(systemActivities)
      .orderBy(desc(systemActivities.timestamp))
      .limit(limit);
  },

  async getAgents() {
    // Return default agents if none exist in DB
    const agents = await db.select().from(systemAgents);
    if (agents.length === 0) {
      return [
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
      ];
    }
    return agents;
  },

  async getCampaigns() {
    // For now, return mock campaigns as the campaign structure is more complex
    return [
      {
        id: "demo_campaign_1",
        name: "Welcome Series",
        status: "active",
        totalRecipients: 150,
        emailsSent: 145,
        openRate: 0.35,
        clickRate: 0.12,
        createdAt: new Date().toISOString(),
        goal_prompt: "Get customers excited about their auto financing options",
      },
    ];
  },

  async createCampaign(data: any) {
    // For now, return mock campaign
    const campaign = {
      id: `campaign_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "active",
      totalRecipients: 0,
      emailsSent: 0,
      openRate: 0,
      clickRate: 0,
      ...data,
    };
    return campaign;
  },

  async createActivity(type: string, description: string, agentType?: string, metadata?: any) {
    const activity = {
      id: `activity_${Date.now()}`,
      type,
      description,
      agentType,
      metadata,
    };

    const [inserted] = await db.insert(systemActivities).values(activity).returning();
    return inserted;
  },

  async getStats() {
    const leads = await db.select().from(systemLeads);
    const activities = await db.select().from(systemActivities);
    const agents = await this.getAgents();

    return {
      leads: leads.length,
      activities: activities.length,
      agents: agents.length,
      campaigns: 1, // Mock for now
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  },
};
