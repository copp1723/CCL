// Remove dependency on @openai/agents
// import { Agent, tool } from "@openai/agents";

// Define Agent interface locally
interface Agent {
  name: string;
  instructions: string;
  tools: any[];
}
import { storage } from "../storage";
import { createHash } from "crypto";
import type { InsertVisitor, InsertAgentActivity } from "@shared/schema";

export interface AbandonmentEvent {
  sessionId: string;
  email: string;
  step: number;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class VisitorIdentifierAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      name: "Visitor Identifier Agent",
      instructions: `
        You are responsible for detecting abandonment events and managing visitor data.
        Your primary tasks:
        1. Process abandonment events from various sources
        2. Create and update visitor records with PII protection
        3. Emit lead_ready events when appropriate
        4. Apply guardrails to strip PII beyond email hash
        
        Always hash email addresses for storage and never store raw email data.
        Validate all input data and sanitize before processing.
      `,
      tools: [
        this.createDetectAbandonmentTool(),
        this.createStoreVisitorTool(),
        this.createEmitLeadReadyTool(),
      ],
    });
  }

  private createDetectAbandonmentTool() {
    return tool({
      name: "detect_abandonment",
      description: "Detect and process abandonment events from visitors",
      execute: async (params: { event: AbandonmentEvent }) => {
        try {
          const { event } = params;

          // Validate event data
          if (!event.email || !event.sessionId || !event.step) {
            throw new Error("Invalid abandonment event data");
          }

          // Hash email for PII protection
          const emailHash = this.hashEmail(event.email);

          // Strip PII beyond email hash
          const sanitizedEvent = {
            sessionId: event.sessionId,
            emailHash,
            abandonmentStep: event.step,
            abandonmentTime: event.timestamp,
          };

          console.log(
            `[VisitorIdentifierAgent] Processing abandonment event for session: ${event.sessionId}`
          );

          return {
            success: true,
            emailHash,
            sanitizedEvent,
            message: "Abandonment event detected and sanitized",
          };
        } catch (error) {
          console.error("[VisitorIdentifierAgent] Error detecting abandonment:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  private createStoreVisitorTool() {
    return tool({
      name: "store_visitor",
      description: "Store visitor data in the database with PII protection",
      execute: async (params: { visitorData: Partial<InsertVisitor> }) => {
        try {
          const { visitorData } = params;

          // Check if visitor already exists
          const existingVisitor = await storage.getVisitorByEmailHash(visitorData.emailHash!);

          let visitor;
          if (existingVisitor) {
            // Update existing visitor
            visitor = await storage.updateVisitor(existingVisitor.id, visitorData);
            console.log(`[VisitorIdentifierAgent] Updated visitor: ${existingVisitor.id}`);
          } else {
            // Create new visitor
            visitor = await storage.createVisitor(visitorData as InsertVisitor);
            console.log(`[VisitorIdentifierAgent] Created new visitor: ${visitor.id}`);
          }

          // Log activity
          await storage.createAgentActivity({
            agentName: "visitor_identifier",
            action: existingVisitor ? "visitor_updated" : "visitor_created",
            details: `Visitor ${existingVisitor ? "updated" : "created"} from abandonment event`,
            visitorId: visitor.id,
            status: "success",
          });

          return {
            success: true,
            visitor,
            message: `Visitor ${existingVisitor ? "updated" : "created"} successfully`,
          };
        } catch (error) {
          console.error("[VisitorIdentifierAgent] Error storing visitor:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  private createEmitLeadReadyTool() {
    return tool({
      name: "emit_lead_ready",
      description: "Emit lead_ready event when visitor is qualified for re-engagement",
      execute: async (params: { visitorId: number; reason: string }) => {
        try {
          const { visitorId, reason } = params;

          const visitor = await storage.getVisitor(visitorId);
          if (!visitor) {
            throw new Error("Visitor not found");
          }

          // Log lead_ready event
          await storage.createAgentActivity({
            agentName: "visitor_identifier",
            action: "lead_ready",
            details: `Lead ready for re-engagement: ${reason}`,
            visitorId: visitorId,
            status: "success",
          });

          console.log(
            `[VisitorIdentifierAgent] Emitted lead_ready event for visitor: ${visitorId}`
          );

          return {
            success: true,
            visitorId,
            event: "lead_ready",
            message: "Lead ready event emitted successfully",
          };
        } catch (error) {
          console.error("[VisitorIdentifierAgent] Error emitting lead_ready:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  private hashEmail(email: string): string {
    return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
  }

  async processAbandonmentEvent(
    event: AbandonmentEvent
  ): Promise<{ success: boolean; visitorId?: number; error?: string }> {
    try {
      // Hash email for PII protection
      const emailHash = this.hashEmail(event.email);

      // Create visitor data with PII protection
      const visitorData: InsertVisitor = {
        emailHash,
        sessionId: event.sessionId,
        abandonmentStep: event.step,
        abandonmentTime: event.timestamp,
      };

      // Check if visitor exists
      const existingVisitor = await storage.getVisitorByEmailHash(emailHash);

      let visitor;
      if (existingVisitor) {
        visitor = await storage.updateVisitor(existingVisitor.id, visitorData);
      } else {
        visitor = await storage.createVisitor(visitorData);
      }

      // Log activity
      await storage.createAgentActivity({
        agentName: "visitor_identifier",
        action: "abandonment_detected",
        details: `Abandonment detected at step ${event.step}`,
        visitorId: visitor.id,
        status: "success",
      });

      // Emit lead_ready event for re-engagement
      await storage.createAgentActivity({
        agentName: "visitor_identifier",
        action: "lead_ready",
        details: "Lead ready for re-engagement after abandonment",
        visitorId: visitor.id,
        status: "success",
      });

      console.log(
        `[VisitorIdentifierAgent] Processed abandonment event for visitor: ${visitor.id}`
      );

      return { success: true, visitorId: visitor.id };
    } catch (error) {
      console.error("[VisitorIdentifierAgent] Error processing abandonment event:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
