// Streamlined storage for CCL agent system
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

class StreamlinedStorage {
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

  // Stats
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
}

export const storage = new StreamlinedStorage();

console.log("Streamlined storage system initialized for data ingestion APIs");
console.log(`Initial stats: ${JSON.stringify(storage.getStats(), null, 2)}`);