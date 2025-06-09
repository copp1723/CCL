import { visitorIdentifierService } from "./visitor-identifier";
import { emailReengagementService } from "./email-reengagement";
import { creditCheckService } from "./credit-check";
import { leadPackagingService } from "./lead-packaging";
import { WebSocketManager } from "../services/websocket";

export {
  // Services
  visitorIdentifierService,
  emailReengagementService,
  creditCheckService,
  leadPackagingService,
};

export interface AgentMetrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

export interface AgentStatus {
  name: string;
  status: "active" | "inactive" | "error";
  lastActivity: Date;
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

export class AgentOrchestrator {
  private wsManager: WebSocketManager;

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // All services initialized via their constructors
    console.log("Agent orchestrator initialized with all services");
  }

  async getAgentMetrics(): Promise<AgentMetrics> {
    try {
      // In a real implementation, these would come from the database
      const activeAgents = 5; // All agents are active

      // Get recent lead count
      const recentLeads = await this.getRecentLeadsCount();

      // Calculate email delivery rate
      const emailDeliveryRate = await this.calculateEmailDeliveryRate();

      // Get average response time from recent chat sessions
      const avgResponseTime = await this.calculateAverageResponseTime();

      return {
        activeAgents,
        leadsGenerated: recentLeads,
        emailDeliveryRate,
        avgResponseTime,
      };
    } catch (error) {
      console.error("Error getting agent metrics:", error);
      return {
        activeAgents: 0,
        leadsGenerated: 0,
        emailDeliveryRate: 0,
        avgResponseTime: 0,
      };
    }
  }

  async getAgentStatuses(): Promise<AgentStatus[]> {
    const statuses: AgentStatus[] = [
      {
        name: "VisitorIdentifierAgent",
        status: "active",
        lastActivity: new Date(),
        processedToday: await this.getAgentProcessedCount("VisitorIdentifierAgent"),
        description: "Detecting abandonment events via SQS",
        icon: "fas fa-search",
        color: "accent",
      },
      {
        name: "EmailReengagementAgent",
        status: "active",
        lastActivity: new Date(),
        processedToday: await this.getAgentProcessedCount("EmailReengagementAgent"),
        description: "Sending personalized emails via SendGrid",
        icon: "fas fa-envelope",
        color: "primary",
      },
      {
        name: "RealtimeChatAgent",
        status: "active",
        lastActivity: new Date(),
        processedToday: await this.getAgentProcessedCount("RealtimeChatAgent"),
        description: "WebSocket chat with <1s latency",
        icon: "fas fa-comments",
        color: "warning",
      },
      {
        name: "CreditCheckAgent",
        status: "active",
        lastActivity: new Date(),
        processedToday: await this.getAgentProcessedCount("CreditCheckAgent"),
        description: "FlexPath API integration for credit checks",
        icon: "fas fa-shield-alt",
        color: "accent",
      },
      {
        name: "LeadPackagingAgent",
        status: "active",
        lastActivity: new Date(),
        processedToday: await this.getAgentProcessedCount("LeadPackagingAgent"),
        description: "Assembling and submitting leads to dealers",
        icon: "fas fa-box",
        color: "primary",
      },
    ];

    return statuses;
  }

  private async getRecentLeadsCount(): Promise<number> {
    try {
      // Simulated lead count for demo
      return Math.floor(Math.random() * 10) + 5;
    } catch (error) {
      console.error("Error getting recent leads count:", error);
      return 0;
    }
  }

  private async calculateEmailDeliveryRate(): Promise<number> {
    try {
      // This would be calculated from actual email campaign data
      // For now, return a realistic value
      return 97.2;
    } catch (error) {
      console.error("Error calculating email delivery rate:", error);
      return 0;
    }
  }

  private async calculateAverageResponseTime(): Promise<number> {
    try {
      // This would be calculated from chat session message timestamps
      // For now, return a target value in seconds
      return 0.8;
    } catch (error) {
      console.error("Error calculating average response time:", error);
      return 0;
    }
  }

  private async getAgentProcessedCount(agentName: string): Promise<number> {
    try {
      // This would query the agent_activity table for today's successful actions
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Simulated for now - in real implementation, query the database
      const counts: Record<string, number> = {
        VisitorIdentifierAgent: 15,
        EmailReengagementAgent: 8,
        RealtimeChatAgent: 12,
        CreditCheckAgent: 6,
        LeadPackagingAgent: 4,
      };

      return counts[agentName] || 0;
    } catch (error) {
      console.error(`Error getting processed count for ${agentName}:`, error);
      return 0;
    }
  }

  async shutdown(): Promise<void> {
    console.log("Shutting down agent orchestrator...");
    console.log("Agent orchestrator shutdown complete");
  }
}

export let agentOrchestrator: AgentOrchestrator;

export function initializeAgentOrchestrator(wsManager: WebSocketManager): AgentOrchestrator {
  agentOrchestrator = new AgentOrchestrator(wsManager);
  return agentOrchestrator;
}
