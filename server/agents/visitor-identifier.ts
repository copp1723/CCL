import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { generateEmailHash } from '../services/token';

export interface AbandonmentEvent {
  sessionId: string;
  email: string;
  step: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export const visitorIdentifierAgent = new Agent({
  name: 'VisitorIdentifierAgent',
  instructions: `
    You are responsible for detecting abandonment events and managing visitor data.
    
    Key responsibilities:
    1. Process AbandonmentEvent data received via SQS
    2. Detect when users abandon their auto-loan application
    3. Store visitor information securely (email hashed for PII protection)
    4. Emit lead_ready events when visitors qualify for re-engagement
    
    Guardrails:
    - Always hash email addresses before storage
    - Strip any PII beyond email hash
    - Validate all input data before processing
    - Log all activities for audit trail
    
    Process:
    1. Receive abandonment event
    2. Hash the email address
    3. Check if visitor already exists
    4. Update or create visitor record
    5. Mark abandonment detected
    6. Emit lead_ready event if qualified
  `,
});

export class VisitorIdentifierService {
  private detectionInterval: NodeJS.Timeout | null = null;

  async processAbandonmentEvent(event: AbandonmentEvent): Promise<void> {
    try {
      // Hash email for PII protection
      const emailHash = generateEmailHash(event.email);
      
      // Check if visitor exists
      let visitor = await storage.getVisitorByEmailHash(emailHash);
      
      if (!visitor) {
        // Create new visitor
        visitor = await storage.createVisitor({
          emailHash,
          sessionId: event.sessionId,
          lastActivity: new Date(),
          abandonmentDetected: true,
        });
      } else {
        // Update existing visitor
        visitor = await storage.updateVisitor(visitor.id, {
          sessionId: event.sessionId,
          lastActivity: new Date(),
          abandonmentDetected: true,
        });
      }

      // Log activity
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'abandonment_detected',
        details: `Step ${event.step} abandonment for session ${event.sessionId}`,
        visitorId: visitor.id,
        status: 'success',
      });

      // Check if visitor qualifies for re-engagement
      if (this.qualifiesForReengagement(visitor, event)) {
        await this.emitLeadReady(visitor);
      }

    } catch (error) {
      console.error('Error processing abandonment event:', error);
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'abandonment_processing_error',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error',
      });
    }
  }

  private qualifiesForReengagement(visitor: any, event: AbandonmentEvent): boolean {
    // Qualification logic - visitor abandoned at step 3 or later
    return event.step >= 3 && !visitor.emailCampaignSent;
  }

  private async emitLeadReady(visitor: any): Promise<void> {
    // Create lead ready event (in a real system, this would publish to SQS/EventBridge)
    console.log(`Lead ready event emitted for visitor ${visitor.id}`);
    
    await storage.createAgentActivity({
      agentName: 'VisitorIdentifierAgent',
      action: 'lead_ready_emitted',
      details: `Lead ready for visitor ${visitor.id}`,
      visitorId: visitor.id,
      status: 'success',
    });
  }

  startAbandonmentDetection(): void {
    // Check for abandonment every 60 seconds
    this.detectionInterval = setInterval(async () => {
      await this.detectAbandonmentBatch();
    }, 60000);
  }

  stopAbandonmentDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  private async detectAbandonmentBatch(): Promise<void> {
    try {
      // Get visitors with recent activity but no completion
      const recentVisitors = await storage.getRecentActiveVisitors();
      
      for (const visitor of recentVisitors) {
        const timeSinceActivity = Date.now() - visitor.lastActivity.getTime();
        
        // If more than 5 minutes since last activity, consider abandoned
        if (timeSinceActivity > 5 * 60 * 1000 && !visitor.abandonmentDetected) {
          await this.processAbandonmentEvent({
            sessionId: visitor.sessionId,
            email: '', // We only have hash, so simulate with empty
            step: 2, // Assume step 2 for batch detection
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Error in abandonment detection batch:', error);
    }
  }
}

export const visitorIdentifierService = new VisitorIdentifierService();
