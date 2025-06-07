// Database storage implementation for CCL agent system
import { randomUUID } from 'crypto';
import {
  systemLeads,
  systemActivities,
  systemAgents,
  visitors,
  type SystemLead,
  type SystemActivity,
  type SystemAgent,
  type InsertSystemLead,
  type InsertSystemActivity,
  type InsertSystemAgent,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, count } from "drizzle-orm";
import { dbOptimizer } from "./services/performance-optimizer";

interface LeadData {
  id: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
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
  status: 'active' | 'inactive' | 'error';
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

interface SystemStats {
  leads: number;
  activities: number;
  agents: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  timestamp: string;
}

export interface StorageInterface {
  // Leads
  createLead(data: { email: string; status: 'new' | 'contacted' | 'qualified' | 'closed'; leadData: any }): Promise<LeadData>;
  getLeads(): Promise<LeadData[]>;
  updateLead(id: string, updates: Partial<LeadData>): Promise<void>;

  // Activities
  createActivity(type: string, description: string, agentType?: string, metadata?: any): Promise<Activity>;
  getActivities(limit?: number): Promise<Activity[]>;

  // Agents
  getAgents(): Promise<Agent[]>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<void>;

  // Visitors
  createVisitor(data: { ipAddress?: string; userAgent?: string; phoneNumber?: string; email?: string; metadata?: any }): Promise<{ id: string }>;
  updateVisitor(id: string, updates: { phoneNumber?: string; email?: string; metadata?: any }): Promise<void>;

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
        color: "text-blue-600"
      },
      {
        id: "agent_2",
        name: "RealtimeChatAgent",
        status: "active",
        processedToday: 0,
        description: "Handles live customer chat",
        icon: "MessageCircle",
        color: "text-green-600"
      },
      {
        id: "agent_3",
        name: "EmailReengagementAgent",
        status: "active",
        processedToday: 0,
        description: "Sends personalized email campaigns",
        icon: "Mail",
        color: "text-purple-600"
      },

      {
        id: "agent_4",
        name: "LeadPackagingAgent",
        status: "active",
        processedToday: 0,
        description: "Packages leads for dealer submission",
        icon: "Package",
        color: "text-indigo-600"
      }
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
    await this.createActivity("system_startup", "CCL Agent System initialized with database persistence", "System");
    await this.createActivity("api_ready", "Three data ingestion APIs activated", "System");
  }

  async createLead(leadData: Omit<LeadData, 'id' | 'createdAt'>): Promise<LeadData> {
    this.leadCounter++;
    const leadId = `lead_${this.leadCounter}_${Date.now()}`;
    
    const insertData: InsertSystemLead = {
      id: leadId,
      email: leadData.email,
      status: leadData.status,
      leadData: leadData.leadData
    };

    await db.insert(systemLeads).values(insertData);
    
    const newLead: LeadData = {
      id: leadId,
      createdAt: new Date().toISOString(),
      ...leadData
    };
    
    return newLead;
  }

  async getLeads(): Promise<LeadData[]> {
    return await dbOptimizer.getLeadsOptimized();
  }

  async updateLead(id: string, updates: Partial<LeadData>): Promise<void> {
    const updateData: Partial<InsertSystemLead> = {};
    
    if (updates.email) updateData.email = updates.email;
    if (updates.status) updateData.status = updates.status;
    if (updates.leadData) updateData.leadData = updates.leadData;

    await db.update(systemLeads).set(updateData).where(eq(systemLeads.id, id));
  }

  async createActivity(type: string, description: string, agentType?: string, metadata?: any): Promise<Activity> {
    return await dbOptimizer.createActivityOptimized(type, description, agentType, metadata);
  }

  async getActivities(limit: number = 20): Promise<Activity[]> {
    return await dbOptimizer.getActivitiesOptimized(limit);
  }

  async getAgents(): Promise<Agent[]> {
    return await dbOptimizer.getAgentsOptimized();
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
    // Simple count implementation without using count() function
    const leads = await db.select().from(systemLeads);
    const activities = await db.select().from(systemActivities);
    const agents = await db.select().from(systemAgents);
    
    const uptime = (Date.now() - this.startTime) / 1000;
    
    return {
      leads: leads.length,
      activities: activities.length,
      agents: agents.length,
      uptime,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  async createVisitor(data: { ipAddress?: string; userAgent?: string; phoneNumber?: string; email?: string; metadata?: any }): Promise<{ id: string }> {
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

  async updateVisitor(id: string, updates: { phoneNumber?: string; email?: string; metadata?: any }): Promise<void> {
    // Visitor update logic would go here when needed
    console.log(`Visitor ${id} updated:`, updates);
  }
}

export const storage = new DatabaseStorage();