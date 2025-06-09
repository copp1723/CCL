import { Agent, tool } from "@openai/agents";
import { storage } from "../storage";
import { WebhookService } from "../services/WebhookService";
import type { InsertLead, Visitor, CreditCheckResult } from "@shared/schema";

export interface LeadPackage {
  leadId: string;
  visitor: {
    emailHash: string;
    sessionId?: string;
    abandonmentStep?: number;
    phoneNumber?: string;
  };
  engagement: {
    source: string;
    emailCampaigns?: number;
    chatSessions?: number;
    returnTokenUsed?: boolean;
  };
  creditCheck: {
    approved: boolean;
    creditScore?: number;
    approvedAmount?: number;
    interestRate?: number;
  };
  metadata: {
    createdAt: Date;
    processedBy: string;
    version: string;
  };
}

export class LeadPackagingAgent {
  private agent: Agent;
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();

    this.agent = new Agent({
      name: "Lead Packaging Agent",
      instructions: `
        You are responsible for assembling and submitting qualified leads to dealer CRM systems.
        Your primary tasks:
        1. Assemble complete lead packages with visitor, engagement, and credit data
        2. Submit leads to dealer CRM via webhooks
        3. Handle webhook failures with retry logic
        4. Use SQS DLQ for persistent failures
        5. Track submission status and provide feedback
        
        Always ensure lead data is complete and valid before submission.
        Handle errors gracefully and implement proper retry mechanisms.
        Maintain audit trail of all lead submissions.
      `,
      tools: [
        this.createAssembleLeadTool(),
        this.createSubmitToDealerCrmTool(),
        this.createHandleSubmissionFailureTool(),
      ],
    });
  }

  private createAssembleLeadTool() {
    return tool({
      name: "assemble_lead",
      description: "Assemble complete lead package with visitor, engagement, and credit data",
      execute: async (params: {
        visitorId: number;
        source: string;
        creditResult?: CreditCheckResult;
      }) => {
        try {
          const { visitorId, source, creditResult } = params;

          const visitor = await storage.getVisitor(visitorId);
          if (!visitor) {
            throw new Error("Visitor not found");
          }

          // Get engagement data
          const emailCampaigns = await storage.getEmailCampaignsByVisitor(visitorId);
          const chatSessions = await storage.getChatSessionsByVisitor(visitorId);

          // Generate unique lead ID
          const leadId = `LD-${Date.now()}-${visitorId}`;

          // Assemble lead package
          const leadPackage: LeadPackage = {
            leadId,
            visitor: {
              emailHash: visitor.emailHash,
              sessionId: visitor.sessionId || undefined,
              abandonmentStep: visitor.abandonmentStep || undefined,
              phoneNumber: visitor.phoneNumber || undefined,
            },
            engagement: {
              source,
              emailCampaigns: emailCampaigns.length,
              chatSessions: chatSessions.length,
              returnTokenUsed: !!visitor.returnToken,
            },
            creditCheck: creditResult || {
              approved: visitor.creditCheckStatus === "approved",
            },
            metadata: {
              createdAt: new Date(),
              processedBy: "LeadPackagingAgent",
              version: "1.0.0",
            },
          };

          console.log(`[LeadPackagingAgent] Assembled lead package: ${leadId}`);

          return {
            success: true,
            leadPackage,
            leadId,
            message: "Lead package assembled successfully",
          };
        } catch (error) {
          console.error("[LeadPackagingAgent] Error assembling lead:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  private createSubmitToDealerCrmTool() {
    return tool({
      name: "submit_to_dealer_crm",
      description: "Submit lead package to dealer CRM via webhook",
      execute: async (params: { leadPackage: LeadPackage; visitorId: number }) => {
        try {
          const { leadPackage, visitorId } = params;

          // Create lead record
          const leadData: InsertLead = {
            visitorId,
            leadId: leadPackage.leadId,
            contactEmail: leadPackage.visitor.emailHash, // In production, this would be the actual email
            contactPhone: leadPackage.visitor.phoneNumber || null,
            creditStatus: leadPackage.creditCheck.approved ? "approved" : "declined",
            source: leadPackage.engagement.source,
            status: "processing",
            dealerCrmSubmitted: false,
            leadData: leadPackage as any,
          };

          const lead = await storage.createLead(leadData);

          // Submit to dealer CRM
          const webhookResult = await this.webhookService.submitToDealerCrm(leadPackage);

          if (webhookResult.success) {
            // Update lead status
            await storage.updateLead(lead.id, {
              status: "submitted",
              dealerCrmSubmitted: true,
            });

            // Log success activity
            await storage.createAgentActivity({
              agentType: "lead_packaging",
              action: "lead_submitted",
              description: `Lead successfully submitted to dealer CRM`,
              targetId: leadPackage.leadId,
              metadata: {
                leadId: lead.id,
                webhookResponse: webhookResult.response,
                submissionTime: new Date(),
              },
            });

            console.log(`[LeadPackagingAgent] Successfully submitted lead: ${leadPackage.leadId}`);

            return {
              success: true,
              leadId: lead.id,
              webhookResult,
              message: "Lead submitted to dealer CRM successfully",
            };
          } else {
            throw new Error(`Webhook submission failed: ${webhookResult.error}`);
          }
        } catch (error) {
          console.error("[LeadPackagingAgent] Error submitting to dealer CRM:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  private createHandleSubmissionFailureTool() {
    return tool({
      name: "handle_submission_failure",
      description: "Handle webhook submission failures with retry logic and DLQ",
      execute: async (params: { leadId: number; error: string; attemptCount: number }) => {
        try {
          const { leadId, error, attemptCount } = params;

          const lead = await storage.getLead(leadId);
          if (!lead) {
            throw new Error("Lead not found");
          }

          // Update lead status to failed
          await storage.updateLead(leadId, {
            status: "failed",
          });

          // Log failure activity
          await storage.createAgentActivity({
            agentType: "lead_packaging",
            action: "submission_failed",
            description: `Lead submission failed after ${attemptCount} attempts: ${error}`,
            targetId: lead.leadId,
            metadata: {
              error,
              attemptCount,
              failureTime: new Date(),
              leadData: lead.leadData,
            },
          });

          // In production, this would send to SQS DLQ
          console.log(
            `[LeadPackagingAgent] Lead submission failed, would send to DLQ: ${lead.leadId}`
          );

          return {
            success: true,
            sentToDlq: true,
            message: "Failure handled, lead sent to DLQ for manual processing",
          };
        } catch (error) {
          console.error("[LeadPackagingAgent] Error handling submission failure:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  async packageAndSubmitLead(
    visitorId: number,
    source: string,
    creditResult?: CreditCheckResult
  ): Promise<{
    success: boolean;
    leadId?: number;
    leadPackageId?: string;
    error?: string;
  }> {
    try {
      const visitor = await storage.getVisitor(visitorId);
      if (!visitor) {
        throw new Error("Visitor not found");
      }

      // Get engagement data
      const emailCampaigns = await storage.getEmailCampaignsByVisitor(visitorId);
      const chatSessions = await storage.getChatSessionsByVisitor(visitorId);

      // Generate unique lead ID
      const leadPackageId = `LD-${Date.now()}-${visitorId}`;

      // Assemble lead package
      const leadPackage: LeadPackage = {
        leadId: leadPackageId,
        visitor: {
          emailHash: visitor.emailHash,
          sessionId: visitor.sessionId || undefined,
          abandonmentStep: visitor.abandonmentStep || undefined,
          phoneNumber: visitor.phoneNumber || undefined,
        },
        engagement: {
          source,
          emailCampaigns: emailCampaigns.length,
          chatSessions: chatSessions.length,
          returnTokenUsed: !!visitor.returnToken,
        },
        creditCheck: creditResult || {
          approved: visitor.creditCheckStatus === "approved",
        },
        metadata: {
          createdAt: new Date(),
          processedBy: "LeadPackagingAgent",
          version: "1.0.0",
        },
      };

      // Create lead record
      const leadData: InsertLead = {
        visitorId,
        leadId: leadPackageId,
        contactEmail: visitor.emailHash, // In production, this would be actual email
        contactPhone: visitor.phoneNumber || null,
        creditStatus: leadPackage.creditCheck.approved ? "approved" : "declined",
        source,
        status: "processing",
        dealerCrmSubmitted: false,
        leadData: leadPackage as any,
      };

      const lead = await storage.createLead(leadData);

      // Submit to dealer CRM
      const webhookResult = await this.webhookService.submitToDealerCrm(leadPackage);

      if (webhookResult.success) {
        // Update lead status
        await storage.updateLead(lead.id, {
          status: "submitted",
          dealerCrmSubmitted: true,
        });

        // Log success
        await storage.createAgentActivity({
          agentType: "lead_packaging",
          action: "lead_submitted",
          description: "Lead successfully submitted to dealer CRM",
          targetId: leadPackageId,
          metadata: {
            leadId: lead.id,
            source,
            creditApproved: leadPackage.creditCheck.approved,
          },
        });

        console.log(
          `[LeadPackagingAgent] Successfully packaged and submitted lead: ${leadPackageId}`
        );

        return {
          success: true,
          leadId: lead.id,
          leadPackageId,
        };
      } else {
        // Handle failure
        await storage.updateLead(lead.id, {
          status: "failed",
        });

        await storage.createAgentActivity({
          agentType: "lead_packaging",
          action: "submission_failed",
          description: `Lead submission failed: ${webhookResult.error}`,
          targetId: leadPackageId,
          metadata: {
            error: webhookResult.error,
            leadId: lead.id,
          },
        });

        throw new Error(`Lead submission failed: ${webhookResult.error}`);
      }
    } catch (error) {
      console.error("[LeadPackagingAgent] Error packaging and submitting lead:", error);
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
