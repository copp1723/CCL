// Database storage for CCL agent system
import { randomUUID } from 'crypto';
import {
  systemLeads,
  systemActivities,
  systemAgents,
  type SystemLead,
  type SystemActivity,
  type SystemAgent,
  type InsertSystemLead,
  type InsertSystemActivity,
  type InsertSystemAgent,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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
  createLead(data: { email: string; status: 'new' | 'contacted' | 'qualified' | 'closed'; leadData: any }): LeadData;
  getLeads(): LeadData[];
  updateLead(id: string, updates: Partial<LeadData>): void;

  // Activities
  createActivity(type: string, description: string, agentType?: string, metadata?: any): Activity;
  getActivities(limit?: number): Activity[];

  // Agents
  getAgents(): Agent[];
  updateAgent(id: string, updates: Partial<Agent>): void;

  // Visitors
  createVisitor(data: { ipAddress?: string; userAgent?: string; metadata?: any }): { id: string };
  updateVisitor(id: string, updates: { phoneNumber?: string; email?: string; metadata?: any }): void;

  // Stats
  getStats(): SystemStats;
}

class StreamlinedStorage implements StorageInterface {
  private leadCounter = 0;
  private activityCounter = 0;
  private leadStore: LeadData[] = [];
  private activityStore: Activity[] = [];
  private agentStore: Agent[] = [];

  constructor() {
    this.initializeAgents();
    this.createActivity("system_startup", "CCL Agent System initialized with Mailgun integration", "System");
    this.createActivity("api_ready", "Three data ingestion APIs activated", "System");
  }

  private initializeAgents() {
    this.agentStore = [
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
        name: "CreditCheckAgent",
        status: "active",
        processedToday: 0,
        description: "Processes credit applications",
        icon: "CreditCard",
        color: "text-orange-600"
      },
      {
        id: "agent_5",
        name: "LeadPackagingAgent",
        status: "active",
        processedToday: 0,
        description: "Packages leads for dealer CRM",
        icon: "Package",
        color: "text-indigo-600"
      }
    ];
  }

  // Leads
  createLead(leadData: Omit<LeadData, 'id' | 'createdAt'>): LeadData {
    this.leadCounter++;
    const newLead: LeadData = {
      id: `lead_${this.leadCounter}_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...leadData
    };
    this.leadStore.unshift(newLead);
    return newLead;
  }

  getLeads(): LeadData[] {
    return this.leadStore;
  }

  updateLead(id: string, updates: Partial<LeadData>): void {
    const leadIndex = this.leadStore.findIndex(lead => lead.id === id);
    if (leadIndex > -1) {
      this.leadStore[leadIndex] = { ...this.leadStore[leadIndex], ...updates };
    }
  }

  // Activities
  createActivity(type: string, description: string, agentType?: string, metadata?: any): Activity {
    this.activityCounter++;
    const newActivity: Activity = {
      id: `activity_${this.activityCounter}_${Date.now()}`,
      type,
      description,
      agentType,
      metadata,
      timestamp: new Date().toISOString()
    };
    this.activityStore.unshift(newActivity);

    // Update agent processed count
    if (agentType && agentType !== 'System') {
      const agent = this.agentStore.find(a => a.name === agentType);
      if (agent) {
        agent.processedToday++;
      }
    }

    return newActivity;
  }

  getActivities(): Activity[] {
    return this.activityStore;
  }

  // Agents
  getAgents(): Agent[] {
    return this.agentStore;
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    const agentIndex = this.agentStore.findIndex(agent => agent.id === id);
    if (agentIndex > -1) {
      this.agentStore[agentIndex] = { ...this.agentStore[agentIndex], ...updates };
    }
  }

  // Stats
  getStats(): SystemStats {
    return {
      leads: this.leadStore.length,
      activities: this.activityStore.length,
      agents: this.agentStore.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  createVisitor(data: { ipAddress?: string; userAgent?: string; metadata?: any }): { id: string } {
    const visitor = {
      id: randomUUID(),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata || {},
      createdAt: new Date().toISOString()
    };

    // Store visitor (in a real system, this would go to database)
    return { id: visitor.id };
  }

  updateVisitor(id: string, updates: { phoneNumber?: string; email?: string; metadata?: any }): void {
    // In a real system, this would update the visitor in database
    console.log(`Updating visitor ${id} with:`, updates);
  }

}

export const storage = new StreamlinedStorage();

console.log("Streamlined storage system initialized for data ingestion APIs");
console.log(`Initial stats: ${JSON.stringify(storage.getStats(), null, 2)}`);