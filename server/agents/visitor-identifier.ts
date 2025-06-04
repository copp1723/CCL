import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { hashEmail } from '../utils/pii';
import { generateSessionId } from '../utils/tokens';
import type { AbandonmentEvent, LeadReadyEvent } from '@shared/schema';
import EventEmitter from 'events';

export class VisitorIdentifierAgent extends EventEmitter {
  private agent: Agent;
  private abandonmentCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.agent = new Agent({
      name: 'VisitorIdentifierAgent',
      instructions: `
        You are the Visitor Identifier Agent responsible for detecting abandonment events 
        in auto-loan applications. Your role is to:
        
        1. Monitor visitor sessions for abandonment patterns
        2. Process abandonment events from SQS queue
        3. Store visitor data with PII protection (email hashing)
        4. Emit lead_ready events for qualified abandoned visitors
        5. Ensure data sanitization and guardrails compliance
        
        Key Guidelines:
        - Strip PII beyond email hash for data protection
        - Detect abandonment after 60 seconds of inactivity
        - Only emit lead_ready for visitors with complete contact information
        - Log all actions for observability
      `,
    });

    this.startAbandonmentDetection();
  }

  /**
   * Process abandonment event from SQS
   */
  async processAbandonmentEvent(event: AbandonmentEvent): Promise<void> {
    try {
      console.log(`[VisitorIdentifierAgent] Processing abandonment event for visitor ${event.visitorId}`);

      // Log agent activity
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'process_abandonment',
        entityId: event.visitorId.toString(),
        entityType: 'visitor',
        status: 'processing',
        metadata: { 
          sessionId: event.sessionId,
          abandonmentStep: event.abandonmentStep 
        }
      });

      // Get or create visitor
      let visitor = await storage.getVisitor(event.visitorId);
      
      if (!visitor) {
        // Create new visitor with PII protection
        visitor = await storage.createVisitor({
          emailHash: event.emailHash,
          sessionId: event.sessionId,
          abandonmentStep: event.abandonmentStep,
          isAbandoned: true,
          lastActivity: new Date(),
          metadata: event.metadata
        });
        
        console.log(`[VisitorIdentifierAgent] Created new visitor ${visitor.id}`);
      } else {
        // Update existing visitor
        visitor = await storage.updateVisitor(event.visitorId, {
          abandonmentStep: event.abandonmentStep,
          isAbandoned: true,
          lastActivity: new Date(),
          metadata: { ...visitor.metadata, ...event.metadata }
        });
        
        console.log(`[VisitorIdentifierAgent] Updated visitor ${visitor.id}`);
      }

      if (!visitor) {
        throw new Error('Failed to create or update visitor');
      }

      // Emit lead_ready event if visitor qualifies
      if (this.shouldEmitLeadReady(visitor)) {
        const leadReadyEvent: LeadReadyEvent = {
          visitorId: visitor.id,
          source: 'abandonment'
        };
        
        this.emit('lead_ready', leadReadyEvent);
        
        await storage.createAgentActivity({
          agentName: 'VisitorIdentifierAgent',
          action: 'emit_lead_ready',
          entityId: visitor.id.toString(),
          entityType: 'visitor',
          status: 'completed',
          metadata: { source: 'abandonment' }
        });
        
        console.log(`[VisitorIdentifierAgent] Emitted lead_ready for visitor ${visitor.id}`);
      }

      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'process_abandonment',
        entityId: visitor.id.toString(),
        entityType: 'visitor',
        status: 'completed'
      });

    } catch (error) {
      console.error('[VisitorIdentifierAgent] Error processing abandonment event:', error);
      
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'process_abandonment',
        entityId: event.visitorId.toString(),
        entityType: 'visitor',
        status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  /**
   * Start periodic abandonment detection (every 60 seconds)
   */
  private startAbandonmentDetection(): void {
    this.abandonmentCheckInterval = setInterval(async () => {
      await this.detectAbandonment();
    }, 60000); // 60 seconds

    console.log('[VisitorIdentifierAgent] Started abandonment detection (60s interval)');
  }

  /**
   * Detect abandonment based on inactivity
   */
  private async detectAbandonment(): Promise<void> {
    try {
      // This would normally check active sessions from a session store
      // For now, we'll simulate by checking recent visitor activity
      const cutoffTime = new Date(Date.now() - 60000); // 60 seconds ago
      
      console.log('[VisitorIdentifierAgent] Checking for abandoned sessions...');
      
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'detect_abandonment',
        entityType: 'system',
        status: 'completed',
        metadata: { cutoffTime: cutoffTime.toISOString() }
      });
      
    } catch (error) {
      console.error('[VisitorIdentifierAgent] Error in abandonment detection:', error);
    }
  }

  /**
   * Check if visitor qualifies for lead_ready event
   */
  private shouldEmitLeadReady(visitor: any): boolean {
    // Emit lead_ready if:
    // 1. Visitor is marked as abandoned
    // 2. Has sufficient metadata (indicates engagement)
    // 3. Abandoned at a meaningful step (not immediate bounce)
    
    return visitor.isAbandoned && 
           visitor.abandonmentStep > 1 && 
           visitor.metadata && 
           Object.keys(visitor.metadata).length > 0;
  }

  /**
   * Register visitor session
   */
  async registerVisitorSession(emailHash: string, metadata?: any): Promise<number> {
    try {
      const sessionId = generateSessionId();
      
      const visitor = await storage.createVisitor({
        emailHash,
        sessionId,
        isAbandoned: false,
        lastActivity: new Date(),
        metadata
      });

      console.log(`[VisitorIdentifierAgent] Registered visitor session ${visitor.id}`);

      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'register_session',
        entityId: visitor.id.toString(),
        entityType: 'visitor',
        status: 'completed',
        metadata: { sessionId }
      });

      return visitor.id;
    } catch (error) {
      console.error('[VisitorIdentifierAgent] Error registering visitor session:', error);
      throw error;
    }
  }

  /**
   * Update visitor activity
   */
  async updateVisitorActivity(visitorId: number, step?: number, metadata?: any): Promise<void> {
    try {
      const updates: any = {
        lastActivity: new Date(),
        isAbandoned: false
      };

      if (step !== undefined) {
        updates.abandonmentStep = step;
      }

      if (metadata) {
        const visitor = await storage.getVisitor(visitorId);
        updates.metadata = { ...visitor?.metadata, ...metadata };
      }

      await storage.updateVisitor(visitorId, updates);

      console.log(`[VisitorIdentifierAgent] Updated activity for visitor ${visitorId}`);
    } catch (error) {
      console.error('[VisitorIdentifierAgent] Error updating visitor activity:', error);
    }
  }

  /**
   * Stop abandonment detection
   */
  stop(): void {
    if (this.abandonmentCheckInterval) {
      clearInterval(this.abandonmentCheckInterval);
      this.abandonmentCheckInterval = null;
      console.log('[VisitorIdentifierAgent] Stopped abandonment detection');
    }
  }
}

export const visitorIdentifierAgent = new VisitorIdentifierAgent();
