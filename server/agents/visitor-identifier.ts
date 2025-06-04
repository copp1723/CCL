import { storage } from '../storage';
import { generateEmailHash } from '../services/token';
import { piiProtectionService } from '../services/external-apis';

export interface AbandonmentEvent {
  sessionId: string;
  email: string;
  step: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export class VisitorIdentifierService {
  async processAbandonmentEvent(event: AbandonmentEvent): Promise<{ success: boolean; visitorId?: number; error?: string }> {
    try {
      // Validate and sanitize email
      const emailValidation = await piiProtectionService.validateEmail(event.email);
      if (!emailValidation.valid) {
        throw new Error(`Invalid email: ${emailValidation.reason || 'Unknown validation error'}`);
      }

      const emailHash = generateEmailHash(event.email);
      
      // Check if visitor already exists
      let visitor = await storage.getVisitorByEmailHash(emailHash);
      
      if (!visitor) {
        // Create new visitor
        visitor = await storage.createVisitor({
          sessionId: event.sessionId,
          emailHash,
          lastActivity: event.timestamp,
          abandonmentDetected: true,
        });
      } else {
        // Update existing visitor
        visitor = await storage.updateVisitor(visitor.id, {
          sessionId: event.sessionId,
          lastActivity: event.timestamp,
          abandonmentDetected: true,
        });
      }

      // Log activity
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'abandonment_detected',
        status: 'success',
        details: `Step ${event.step} abandonment detected`,
        visitorId: visitor.id,
      });

      return { success: true, visitorId: visitor.id };
    } catch (error) {
      await storage.createAgentActivity({
        agentName: 'VisitorIdentifierAgent',
        action: 'abandonment_detection_failed',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const visitorIdentifierService = new VisitorIdentifierService();