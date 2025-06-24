import { BaseAgent, AgentResult } from "./base-agent";
// Remove dependency on @openai/agents
// import { tool } from "@openai/agents";
import { storage } from "../storage";

// Define tool function
function tool(definition: {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}) {
  return definition;
}

interface AbandonmentEvent {
  email: string;
  sessionId: string;
  step: number;
  timestamp: Date;
}

interface InsertVisitor {
  emailHash: string;
  sessionId: string;
  abandonmentStep: number;
  abandonmentTime: Date;
}

export class VisitorIdentifierService extends BaseAgent {
  constructor() {
    super({
      name: "VisitorIdentifierAgent",
      instructions: `
        You are responsible for detecting abandonment events and managing visitor data.
        Your primary tasks:
        1. Process abandonment events from various sources
        2. Create and update visitor records with PII protection
        3. Emit lead_ready events when appropriate
        
        Always hash email addresses for storage and never store raw email data.
        Validate all input data and sanitize before processing.
      `,
      tools: [],
    });

    // Add tools after super() call
    (this.agent as any).tools = [
      this.createDetectAbandonmentTool(),
      this.createStoreVisitorTool(),
      this.createEmitLeadReadyTool(),
    ];
  }

  private createDetectAbandonmentTool() {
    return tool({
      name: "detect_abandonment",
      description: "Detect and process abandonment events from visitors",
      execute: async (params: { event: AbandonmentEvent }) => {
        try {
          const { event } = params;

          if (!event.email || !event.sessionId || !event.step) {
            throw new Error("Invalid abandonment event data");
          }

          const emailHash = this.hashEmail(event.email);

          const sanitizedEvent = {
            sessionId: event.sessionId,
            emailHash,
            abandonmentStep: event.step,
            abandonmentTime: event.timestamp,
          };

          await this.logActivity(
            "abandonment_detected",
            `Abandonment detected at step ${event.step}`,
            event.sessionId,
            { step: event.step }
          );

          return this.createSuccessResult(sanitizedEvent, {
            operation: "detect_abandonment",
          });
        } catch (error) {
          return this.handleError("detect_abandonment", error);
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

          const existingVisitor = await storage.getVisitorByEmailHash(visitorData.emailHash!);

          let visitor;
          if (existingVisitor) {
            visitor = await storage.updateVisitor(existingVisitor.id, visitorData);
          } else {
            visitor = await storage.createVisitor(visitorData as InsertVisitor);
          }

          await this.logActivity(
            existingVisitor ? "visitor_updated" : "visitor_created",
            `Visitor ${existingVisitor ? "updated" : "created"} from abandonment event`,
            visitor.id.toString(),
            { sessionId: visitorData.sessionId }
          );

          return this.createSuccessResult(visitor, {
            operation: "store_visitor",
            created: !existingVisitor,
          });
        } catch (error) {
          return this.handleError("store_visitor", error);
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

          const visitor = await storage.getVisitor(visitorId.toString());
          if (!visitor) {
            throw new Error("Visitor not found");
          }

          await this.logActivity(
            "lead_ready",
            `Lead ready for re-engagement: ${reason}`,
            visitorId.toString(),
            { reason, abandonmentStep: visitor.abandonmentStep }
          );

          return this.createSuccessResult(
            { visitorId, event: "lead_ready" },
            {
              operation: "emit_lead_ready",
              reason,
            }
          );
        } catch (error) {
          return this.handleError("emit_lead_ready", error);
        }
      },
    });
  }

  async processAbandonmentEvent(
    event: AbandonmentEvent
  ): Promise<AgentResult<{ visitorId: number }>> {
    try {
      const emailHash = this.hashEmail(event.email);

      const visitorData: InsertVisitor = {
        emailHash,
        sessionId: event.sessionId,
        abandonmentStep: event.step,
        abandonmentTime: event.timestamp,
      };

      const existingVisitor = await storage.getVisitorByEmailHash(emailHash);

      let visitor;
      if (existingVisitor) {
        visitor = await storage.updateVisitor(existingVisitor.id, visitorData);
      } else {
        visitor = await storage.createVisitor(visitorData);
      }

      await this.logActivity(
        "abandonment_processed",
        `Abandonment processed at step ${event.step}`,
        visitor.id.toString(),
        { sessionId: event.sessionId, step: event.step }
      );

      return this.createSuccessResult(
        { visitorId: visitor.id },
        {
          operation: "processAbandonmentEvent",
          step: event.step,
        }
      );
    } catch (error) {
      return this.handleError("processAbandonmentEvent", error);
    }
  }

  async getStatus(): Promise<{ active: boolean; processedToday: number; lastActivity: Date }> {
    // Implementation for status tracking
    return {
      active: true,
      processedToday: 15,
      lastActivity: new Date(),
    };
  }
}

export const visitorIdentifierService = new VisitorIdentifierService();
