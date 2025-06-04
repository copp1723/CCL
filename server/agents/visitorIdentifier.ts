import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import crypto from 'crypto';

export class VisitorIdentifierAgent {
  private agent: Agent;

  constructor() {
    const detectAbandonmentTool = tool({
      name: 'detect_abandonment',
      description: 'Detect when a visitor has abandoned their loan application',
      execute: async ({ sessionId, emailHash, lastActivity }: { 
        sessionId: string; 
        emailHash: string; 
        lastActivity: string;
      }) => {
        return await this.detectAbandonmentForSession(sessionId, emailHash, new Date(lastActivity));
      },
    });

    const storeVisitorTool = tool({
      name: 'store_visitor',
      description: 'Store visitor data with PII protection',
      execute: async ({ sessionId, email, metadata }: {
        sessionId: string;
        email: string;
        metadata?: any;
      }) => {
        const emailHash = this.hashEmail(email);
        const visitor = await storage.createVisitor({
          emailHash,
          sessionId,
          lastActivity: new Date(),
          abandonmentDetected: false,
          metadata: this.sanitizeMetadata(metadata),
        });
        
        await storage.createActivity({
          type: 'visitor_created',
          description: `New visitor detected with session ${sessionId}`,
          agentId: (await storage.getAgentByType('visitor_identifier'))?.id,
          relatedId: visitor.id.toString(),
          metadata: { sessionId }
        });

        return visitor;
      },
    });

    this.agent = new Agent({
      name: 'VisitorIdentifierAgent',
      instructions: `
        You are responsible for detecting abandonment events and managing visitor data.
        
        Key responsibilities:
        1. Monitor visitor sessions for abandonment (no activity for 60+ seconds)
        2. Store visitor data with proper PII protection (hash emails, strip sensitive data)
        3. Emit lead_ready events when abandonment is detected
        4. Ensure data compliance by removing PII beyond email hash
        
        Always hash email addresses and sanitize metadata before storage.
        Detect abandonment when lastActivity is more than 60 seconds ago.
      `,
      tools: [detectAbandonmentTool, storeVisitorTool],
    });
  }

  private hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  }

  private sanitizeMetadata(metadata: any): any {
    if (!metadata) return {};
    
    // Remove PII fields
    const sanitized = { ...metadata };
    delete sanitized.email;
    delete sanitized.phone;
    delete sanitized.ssn;
    delete sanitized.address;
    delete sanitized.firstName;
    delete sanitized.lastName;
    
    return sanitized;
  }

  async processAbandonmentEvent(sessionId: string, email: string) {
    const emailHash = this.hashEmail(email);
    
    let visitor = await storage.getVisitorBySessionId(sessionId);
    if (!visitor) {
      visitor = await storage.createVisitor({
        emailHash,
        sessionId,
        lastActivity: new Date(),
        abandonmentDetected: true,
        metadata: {},
      });
    } else {
      visitor = await storage.updateVisitor(visitor.id, {
        abandonmentDetected: true,
        lastActivity: new Date(),
      });
    }

    if (visitor) {
      await storage.createActivity({
        type: 'abandonment_detected',
        description: `Abandonment detected for session ${sessionId}`,
        agentId: (await storage.getAgentByType('visitor_identifier'))?.id,
        relatedId: visitor.id.toString(),
        metadata: { sessionId, emailHash }
      });

      // Update agent metrics
      const agent = await storage.getAgentByType('visitor_identifier');
      if (agent) {
        await storage.updateAgent(agent.id, {
          eventsProcessed: (agent.eventsProcessed || 0) + 1,
          lastActivity: new Date(),
        });
      }
    }

    return visitor;
  }

  private async detectAbandonmentForSession(sessionId: string, emailHash: string, lastActivity: Date) {
    const now = new Date();
    const timeDiff = now.getTime() - lastActivity.getTime();
    const isAbandoned = timeDiff > 60000; // 60 seconds

    if (isAbandoned) {
      let visitor = await storage.getVisitorBySessionId(sessionId);
      if (!visitor) {
        visitor = await storage.createVisitor({
          emailHash,
          sessionId,
          lastActivity,
          abandonmentDetected: true,
          metadata: {},
        });
      } else if (!visitor.abandonmentDetected) {
        visitor = await storage.updateVisitor(visitor.id, {
          abandonmentDetected: true,
        });
      }

      return { abandoned: true, visitor };
    }

    return { abandoned: false };
  }

  async detectAbandonment() {
    // This would normally check SQS for abandonment events
    // For demo purposes, we'll simulate checking active sessions
    const activeSessions = await storage.getActiveChatSessions();
    
    for (const session of activeSessions) {
      const timeSinceLastMessage = Date.now() - session.lastMessage.getTime();
      if (timeSinceLastMessage > 60000) { // 1 minute
        if (session.visitorId) {
          const visitor = await storage.getVisitor(session.visitorId);
          if (visitor && !visitor.abandonmentDetected) {
            await storage.updateVisitor(visitor.id, {
              abandonmentDetected: true,
            });

            await storage.createActivity({
              type: 'abandonment_detected',
              description: `Session timeout detected for ${session.sessionId}`,
              agentId: (await storage.getAgentByType('visitor_identifier'))?.id,
              relatedId: visitor.id.toString(),
              metadata: { sessionId: session.sessionId }
            });
          }
        }
      }
    }
  }

  getAgent() {
    return this.agent;
  }
}
