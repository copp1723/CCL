import { storage } from '../storage';

export class LeadPackagingService {
  async processApprovedLead(visitorId: number, creditCheckId: number): Promise<{ success: boolean; leadId?: number; error?: string }> {
    try {
      const visitor = await storage.getVisitor(visitorId);
      const creditCheck = await storage.getCreditCheck(creditCheckId);
      
      if (!visitor || !creditCheck) {
        throw new Error('Required data not found');
      }

      // Package lead data
      const leadData = {
        leadId: `lead_${Date.now()}_${visitor.id}`,
        visitor: {
          emailHash: visitor.emailHash,
          sessionId: visitor.sessionId,
          lastActivity: visitor.lastActivity,
        },
        creditAssessment: {
          score: creditCheck.creditScore,
          approved: creditCheck.approved,
          externalId: creditCheck.externalId,
        },
        metadata: {
          createdAt: new Date(),
          source: 'agent_system',
          priority: creditCheck.approved ? 'high' : 'medium',
        }
      };

      // Create lead record
      const lead = await storage.createLead({
        visitorId,
        creditCheckId,
        leadData,
        status: 'submitted',
        dealerResponse: null,
        submittedAt: new Date(),
      });

      // Log activity
      await storage.createAgentActivity({
        agentName: 'LeadPackagingAgent',
        action: 'lead_submitted',
        status: 'success',
        details: `Lead packaged and submitted for visitor ${visitorId}`,
        visitorId,
        leadId: lead.id,
      });

      return { success: true, leadId: lead.id };
    } catch (error) {
      await storage.createAgentActivity({
        agentName: 'LeadPackagingAgent',
        action: 'lead_packaging_failed',
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
        visitorId,
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const leadPackagingService = new LeadPackagingService();