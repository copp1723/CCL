import { Agent, tool } from "@openai/agents";
import { storage } from "../storage";
import { WebhookService } from "../services/WebhookService";
import { boberdooService } from "../services/boberdoo-service";
import { 
  validateCompletePii, 
  LeadPackageSchema,
  BoberdooSubmissionSchema,
  type LeadPackage,
  type BoberdooSubmission,
  type VisitorPii 
} from "../../shared/validation/schemas";
import config from "../config/environment";
import { logger } from "../logger";
import type { InsertLead, Visitor, CreditCheckResult } from "@shared/schema";

// Using LeadPackage type from validation schemas

export class LeadPackagingAgent {
  private agent: Agent;
  private webhookService: WebhookService;
  private logger = logger.child({ component: 'LeadPackagingAgent' });
  private boberdooConfig = config.getBoberdooConfig();

  constructor() {
    this.webhookService = new WebhookService();
    this.logger.info('LeadPackagingAgent initialized', {
      boberdooConfigured: this.boberdooConfig.configured
    });

    this.agent = new Agent({
      name: "Lead Packaging Agent",
      instructions: `
        You are responsible for assembling and submitting qualified leads to monetization platforms.
        Your primary tasks:
        1. Validate complete PII requirements before packaging leads
        2. Assemble complete lead packages with visitor, engagement, and credit data
        3. Submit leads to Boberdoo marketplace for monetization
        4. Handle submission failures with retry logic and DLQ
        5. Track submission status and revenue metrics
        
        CRITICAL: Only process leads with complete PII (all required fields present).
        Use Zod validation to ensure data integrity before submission.
        Prioritize Boberdoo submissions for revenue generation.
        Maintain comprehensive audit trail of all lead submissions.
      `,
      tools: [
        this.createValidatePiiTool(),
        this.createAssembleLeadTool(),
        this.createSubmitToBoberdooTool(),
        this.createSubmitToDealerCrmTool(),
        this.createHandleSubmissionFailureTool(),
      ],
    });
  }

  private createValidatePiiTool() {
    return tool({
      name: "validate_pii",
      description: "Validate that visitor has complete PII required for lead submission",
      execute: async (params: { visitorId: number }) => {
        try {
          const { visitorId } = params;

          const visitor = await storage.getVisitor(visitorId);
          if (!visitor) {
            return {
              success: false,
              error: "Visitor not found"
            };
          }

          // Extract PII data from visitor
          const piiData = {
            firstName: visitor.firstName,
            lastName: visitor.lastName,
            street: visitor.street,
            city: visitor.city,
            state: visitor.state,
            zip: visitor.zip,
            employer: visitor.employer,
            jobTitle: visitor.jobTitle,
            annualIncome: visitor.annualIncome,
            timeOnJobMonths: visitor.timeOnJobMonths,
            phoneNumber: visitor.phoneNumber,
            email: visitor.email,
            emailHash: visitor.emailHash
          };

          // Validate complete PII
          const validation = validateCompletePii(piiData);
          
          if (!validation.isValid) {
            this.logger.warn('Incomplete PII for visitor', {
              visitorId,
              errors: validation.errors
            });
            
            return {
              success: false,
              piiComplete: false,
              errors: validation.errors,
              message: "Visitor PII is incomplete - cannot package lead"
            };
          }

          this.logger.info('PII validation successful', { visitorId });
          
          return {
            success: true,
            piiComplete: true,
            validatedPii: validation.data,
            message: "Visitor has complete PII - ready for lead packaging"
          };

        } catch (error) {
          this.logger.error('PII validation error', {
            visitorId: params.visitorId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
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

          // First validate PII completeness
          const piiData = {
            firstName: visitor.firstName,
            lastName: visitor.lastName,
            street: visitor.street,
            city: visitor.city,
            state: visitor.state,
            zip: visitor.zip,
            employer: visitor.employer,
            jobTitle: visitor.jobTitle,
            annualIncome: visitor.annualIncome,
            timeOnJobMonths: visitor.timeOnJobMonths,
            phoneNumber: visitor.phoneNumber,
            email: visitor.email,
            emailHash: visitor.emailHash
          };

          const piiValidation = validateCompletePii(piiData);
          if (!piiValidation.isValid) {
            throw new Error(`Incomplete PII: ${JSON.stringify(piiValidation.errors)}`);
          }

          // Assemble lead package with validated PII
          const leadPackage: LeadPackage = {
            leadId,
            visitor: piiValidation.data!,
            engagement: {
              source,
              emailCampaigns: emailCampaigns.length,
              chatSessions: chatSessions.length,
              returnTokenUsed: !!visitor.returnToken,
              adClickTs: visitor.adClickTs ? new Date(visitor.adClickTs) : undefined,
              formStartTs: visitor.formStartTs ? new Date(visitor.formStartTs) : undefined,
              abandonmentStep: visitor.abandonmentStep || undefined
            },
            creditCheck: {
              approved: creditResult?.approved || visitor.creditCheckStatus === "approved",
              creditScore: creditResult?.creditScore,
              approvedAmount: creditResult?.approvedAmount,
              interestRate: creditResult?.interestRate,
              denialReason: creditResult?.denialReason,
              checkDate: creditResult?.checkDate || new Date()
            },
            metadata: {
              createdAt: new Date(),
              processedBy: "LeadPackagingAgent",
              version: "1.0.0"
            }
          };

          // Validate complete lead package
          const packageValidation = LeadPackageSchema.safeParse(leadPackage);
          if (!packageValidation.success) {
            throw new Error(`Invalid lead package: ${packageValidation.error.message}`);
          }

          this.logger.info('Lead package assembled successfully', {
            leadId,
            visitorId,
            source,
            piiComplete: true,
            creditApproved: leadPackage.creditCheck.approved
          });

          return {
            success: true,
            leadPackage: packageValidation.data,
            leadId,
            message: "Lead package assembled and validated successfully"
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

  private createSubmitToBoberdooTool() {
    return tool({
      name: "submit_to_boberdoo",
      description: "Submit lead package to Boberdoo marketplace for monetization",
      execute: async (params: { leadPackage: LeadPackage; visitorId: number }) => {
        try {
          const { leadPackage, visitorId } = params;

          if (!this.boberdooConfig.configured) {
            throw new Error('Boberdoo service not configured');
          }

          // Create Boberdoo submission from lead package
          const boberdooSubmission: BoberdooSubmission = {
            vendor_id: this.boberdooConfig.vendorId!,
            vendor_password: this.boberdooConfig.vendorPassword!,
            first_name: leadPackage.visitor.firstName,
            last_name: leadPackage.visitor.lastName,
            email: leadPackage.visitor.email || '',
            phone: leadPackage.visitor.phoneNumber,
            address: leadPackage.visitor.street,
            city: leadPackage.visitor.city,
            state: leadPackage.visitor.state,
            zip: leadPackage.visitor.zip,
            employer: leadPackage.visitor.employer,
            job_title: leadPackage.visitor.jobTitle,
            annual_income: leadPackage.visitor.annualIncome,
            time_on_job: leadPackage.visitor.timeOnJobMonths || 0,
            credit_score: leadPackage.creditCheck.creditScore,
            loan_amount: leadPackage.creditCheck.approvedAmount,
            source: leadPackage.engagement.source,
            lead_id: leadPackage.leadId
          };

          // Validate Boberdoo submission
          const submissionValidation = BoberdooSubmissionSchema.safeParse(boberdooSubmission);
          if (!submissionValidation.success) {
            throw new Error(`Invalid Boberdoo submission: ${submissionValidation.error.message}`);
          }

          // Submit to Boberdoo with retry
          const boberdooResult = await boberdooService.submitLeadWithRetry(submissionValidation.data);

          // Create lead record with Boberdoo status
          const leadData: InsertLead = {
            visitorId,
            leadId: leadPackage.leadId,
            contactEmail: leadPackage.visitor.email || leadPackage.visitor.emailHash,
            contactPhone: leadPackage.visitor.phoneNumber,
            creditStatus: leadPackage.creditCheck.approved ? "approved" : "declined",
            source: leadPackage.engagement.source,
            status: boberdooResult.success ? "submitted" : "failed",
            dealerCrmSubmitted: false,
            boberdooSubmitted: boberdooResult.success,
            boberdooStatus: boberdooResult.status,
            boberdooPrice: boberdooResult.price,
            boberdooBuyerId: boberdooResult.buyerId,
            leadData: leadPackage as any,
          };

          const lead = await storage.createLead(leadData);

          if (boberdooResult.success) {
            // Log successful submission
            await storage.createAgentActivity({
              agentType: "lead_packaging",
              action: "boberdoo_submitted",
              description: `Lead successfully submitted to Boberdoo marketplace`,
              targetId: leadPackage.leadId,
              metadata: {
                leadId: lead.id,
                boberdooStatus: boberdooResult.status,
                price: boberdooResult.price,
                buyerId: boberdooResult.buyerId,
                submissionTime: new Date()
              }
            });

            this.logger.info('Lead submitted to Boberdoo successfully', {
              leadId: leadPackage.leadId,
              boberdooStatus: boberdooResult.status,
              price: boberdooResult.price,
              buyerId: boberdooResult.buyerId
            });

            return {
              success: true,
              leadId: lead.id,
              boberdooResult,
              revenue: boberdooResult.price,
              message: `Lead submitted to Boberdoo successfully - Status: ${boberdooResult.status}`
            };
          } else {
            // Log failed submission
            await storage.createAgentActivity({
              agentType: "lead_packaging",
              action: "boberdoo_failed",
              description: `Boberdoo submission failed: ${boberdooResult.message}`,
              targetId: leadPackage.leadId,
              metadata: {
                leadId: lead.id,
                errorCode: boberdooResult.errorCode,
                errorDetails: boberdooResult.errorDetails,
                submissionTime: new Date()
              }
            });

            throw new Error(`Boberdoo submission failed: ${boberdooResult.message}`);
          }

        } catch (error) {
          this.logger.error('Boberdoo submission error', {
            leadId: params.leadPackage.leadId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
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
            contactEmail: leadPackage.visitor.email || leadPackage.visitor.emailHash,
            contactPhone: leadPackage.visitor.phoneNumber,
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

            this.logger.info('Lead submitted to dealer CRM successfully', {
              leadId: leadPackage.leadId
            });

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

          this.logger.warn('Lead submission failed, adding to DLQ', {
            leadId: lead.leadId,
            attemptCount,
            error
          });

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

  /**
   * Main method to package and submit leads - prioritizes Boberdoo for monetization
   */
  async packageAndSubmitLead(
    visitorId: number,
    source: string,
    creditResult?: CreditCheckResult
  ): Promise<{
    success: boolean;
    leadId?: number;
    leadPackageId?: string;
    revenue?: number;
    boberdooStatus?: string;
    error?: string;
  }> {
    try {
      this.logger.info('Starting lead packaging process', {
        visitorId,
        source,
        creditApproved: creditResult?.approved
      });

      // Step 1: Validate PII completeness
      const piiValidation = await this.validatePii(visitorId);
      if (!piiValidation.piiComplete) {
        this.logger.warn('Cannot package lead - incomplete PII', {
          visitorId,
          errors: piiValidation.errors
        });
        return {
          success: false,
          error: "Incomplete PII - cannot package lead for submission"
        };
      }

      // Step 2: Assemble lead package
      const assembleResult = await this.assembleLead(visitorId, source, creditResult);
      if (!assembleResult.success || !assembleResult.leadPackage) {
        throw new Error(assembleResult.error || "Failed to assemble lead package");
      }

      const { leadPackage, leadId: leadPackageId } = assembleResult;

      // Step 3: Prioritize Boberdoo submission for monetization
      if (this.boberdooConfig.configured) {
        try {
          const boberdooResult = await this.submitToBoberdoo(leadPackage, visitorId);
          
          if (boberdooResult.success) {
            this.logger.info('Lead successfully monetized via Boberdoo', {
              leadId: leadPackageId,
              revenue: boberdooResult.revenue,
              status: boberdooResult.boberdooResult?.status
            });

            return {
              success: true,
              leadId: boberdooResult.leadId,
              leadPackageId,
              revenue: boberdooResult.revenue,
              boberdooStatus: boberdooResult.boberdooResult?.status
            };
          } else {
            this.logger.warn('Boberdoo submission failed, falling back to dealer CRM', {
              leadId: leadPackageId,
              error: boberdooResult.error
            });
          }
        } catch (error) {
          this.logger.error('Boberdoo submission error, falling back to dealer CRM', {
            leadId: leadPackageId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Step 4: Fallback to dealer CRM submission
      try {
        const dealerResult = await this.submitToDealerCrm(leadPackage, visitorId);
        
        if (dealerResult.success) {
          this.logger.info('Lead submitted to dealer CRM as fallback', {
            leadId: leadPackageId
          });

          return {
            success: true,
            leadId: dealerResult.leadId,
            leadPackageId
          };
        } else {
          throw new Error(dealerResult.error || "Dealer CRM submission failed");
        }
      } catch (error) {
        this.logger.error('All submission methods failed', {
          leadId: leadPackageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      }

    } catch (error) {
      this.logger.error('Lead packaging and submission failed', {
        visitorId,
        source,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Helper method to validate PII
   */
  private async validatePii(visitorId: number) {
    const visitor = await storage.getVisitor(visitorId);
    if (!visitor) {
      return { piiComplete: false, errors: ['Visitor not found'] };
    }

    const piiData = {
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      street: visitor.street,
      city: visitor.city,
      state: visitor.state,
      zip: visitor.zip,
      employer: visitor.employer,
      jobTitle: visitor.jobTitle,
      annualIncome: visitor.annualIncome,
      timeOnJobMonths: visitor.timeOnJobMonths,
      phoneNumber: visitor.phoneNumber,
      email: visitor.email,
      emailHash: visitor.emailHash
    };

    const validation = validateCompletePii(piiData);
    return {
      piiComplete: validation.isValid,
      errors: validation.isValid ? undefined : validation.errors,
      validatedPii: validation.data
    };
  }

  /**
   * Helper method to assemble lead
   */
  private async assembleLead(visitorId: number, source: string, creditResult?: CreditCheckResult) {
    const visitor = await storage.getVisitor(visitorId);
    if (!visitor) {
      return { success: false, error: 'Visitor not found' };
    }

    const emailCampaigns = await storage.getEmailCampaignsByVisitor(visitorId);
    const chatSessions = await storage.getChatSessionsByVisitor(visitorId);
    const leadId = `LD-${Date.now()}-${visitorId}`;

    const piiData = {
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      street: visitor.street,
      city: visitor.city,
      state: visitor.state,
      zip: visitor.zip,
      employer: visitor.employer,
      jobTitle: visitor.jobTitle,
      annualIncome: visitor.annualIncome,
      timeOnJobMonths: visitor.timeOnJobMonths,
      phoneNumber: visitor.phoneNumber,
      email: visitor.email,
      emailHash: visitor.emailHash
    };

    const piiValidation = validateCompletePii(piiData);
    if (!piiValidation.isValid) {
      return { success: false, error: `Incomplete PII: ${JSON.stringify(piiValidation.errors)}` };
    }

    const leadPackage: LeadPackage = {
      leadId,
      visitor: piiValidation.data!,
      engagement: {
        source,
        emailCampaigns: emailCampaigns.length,
        chatSessions: chatSessions.length,
        returnTokenUsed: !!visitor.returnToken,
        adClickTs: visitor.adClickTs ? new Date(visitor.adClickTs) : undefined,
        formStartTs: visitor.formStartTs ? new Date(visitor.formStartTs) : undefined,
        abandonmentStep: visitor.abandonmentStep || undefined
      },
      creditCheck: {
        approved: creditResult?.approved || visitor.creditCheckStatus === "approved",
        creditScore: creditResult?.creditScore,
        approvedAmount: creditResult?.approvedAmount,
        interestRate: creditResult?.interestRate,
        denialReason: creditResult?.denialReason,
        checkDate: creditResult?.checkDate || new Date()
      },
      metadata: {
        createdAt: new Date(),
        processedBy: "LeadPackagingAgent",
        version: "1.0.0"
      }
    };

    const packageValidation = LeadPackageSchema.safeParse(leadPackage);
    if (!packageValidation.success) {
      return { success: false, error: `Invalid lead package: ${packageValidation.error.message}` };
    }

    return {
      success: true,
      leadPackage: packageValidation.data,
      leadId
    };
  }

  /**
   * Helper method to submit to Boberdoo
   */
  private async submitToBoberdoo(leadPackage: LeadPackage, visitorId: number) {
    if (!this.boberdooConfig.configured) {
      return { success: false, error: 'Boberdoo service not configured' };
    }

    const boberdooSubmission: BoberdooSubmission = {
      vendor_id: this.boberdooConfig.vendorId!,
      vendor_password: this.boberdooConfig.vendorPassword!,
      first_name: leadPackage.visitor.firstName,
      last_name: leadPackage.visitor.lastName,
      email: leadPackage.visitor.email || '',
      phone: leadPackage.visitor.phoneNumber,
      address: leadPackage.visitor.street,
      city: leadPackage.visitor.city,
      state: leadPackage.visitor.state,
      zip: leadPackage.visitor.zip,
      employer: leadPackage.visitor.employer,
      job_title: leadPackage.visitor.jobTitle,
      annual_income: leadPackage.visitor.annualIncome,
      time_on_job: leadPackage.visitor.timeOnJobMonths || 0,
      credit_score: leadPackage.creditCheck.creditScore,
      loan_amount: leadPackage.creditCheck.approvedAmount,
      source: leadPackage.engagement.source,
      lead_id: leadPackage.leadId
    };

    const submissionValidation = BoberdooSubmissionSchema.safeParse(boberdooSubmission);
    if (!submissionValidation.success) {
      return { success: false, error: `Invalid Boberdoo submission: ${submissionValidation.error.message}` };
    }

    const boberdooResult = await boberdooService.submitLeadWithRetry(submissionValidation.data);

    const leadData: InsertLead = {
      visitorId,
      leadId: leadPackage.leadId,
      contactEmail: leadPackage.visitor.email || leadPackage.visitor.emailHash,
      contactPhone: leadPackage.visitor.phoneNumber,
      creditStatus: leadPackage.creditCheck.approved ? "approved" : "declined",
      source: leadPackage.engagement.source,
      status: boberdooResult.success ? "submitted" : "failed",
      dealerCrmSubmitted: false,
      boberdooSubmitted: boberdooResult.success,
      boberdooStatus: boberdooResult.status,
      boberdooPrice: boberdooResult.price,
      boberdooBuyerId: boberdooResult.buyerId,
      leadData: leadPackage as any,
    };

    const lead = await storage.createLead(leadData);

    if (boberdooResult.success) {
      await storage.createAgentActivity({
        agentType: "lead_packaging",
        action: "boberdoo_submitted",
        description: `Lead successfully submitted to Boberdoo marketplace`,
        targetId: leadPackage.leadId,
        metadata: {
          leadId: lead.id,
          boberdooStatus: boberdooResult.status,
          price: boberdooResult.price,
          buyerId: boberdooResult.buyerId,
          submissionTime: new Date()
        }
      });

      return {
        success: true,
        leadId: lead.id,
        boberdooResult,
        revenue: boberdooResult.price
      };
    } else {
      await storage.createAgentActivity({
        agentType: "lead_packaging",
        action: "boberdoo_failed",
        description: `Boberdoo submission failed: ${boberdooResult.message}`,
        targetId: leadPackage.leadId,
        metadata: {
          leadId: lead.id,
          errorCode: boberdooResult.errorCode,
          errorDetails: boberdooResult.errorDetails,
          submissionTime: new Date()
        }
      });

      return { success: false, error: boberdooResult.message };
    }
  }

  /**
   * Helper method to submit to dealer CRM
   */
  private async submitToDealerCrm(leadPackage: LeadPackage, visitorId: number) {
    const leadData: InsertLead = {
      visitorId,
      leadId: leadPackage.leadId,
      contactEmail: leadPackage.visitor.email || leadPackage.visitor.emailHash,
      contactPhone: leadPackage.visitor.phoneNumber,
      creditStatus: leadPackage.creditCheck.approved ? "approved" : "declined",
      source: leadPackage.engagement.source,
      status: "processing",
      dealerCrmSubmitted: false,
      leadData: leadPackage as any,
    };

    const lead = await storage.createLead(leadData);
    const webhookResult = await this.webhookService.submitToDealerCrm(leadPackage);

    if (webhookResult.success) {
      await storage.updateLead(lead.id, {
        status: "submitted",
        dealerCrmSubmitted: true,
      });

      await storage.createAgentActivity({
        agentType: "lead_packaging",
        action: "dealer_crm_submitted",
        description: "Lead successfully submitted to dealer CRM",
        targetId: leadPackage.leadId,
        metadata: {
          leadId: lead.id,
          webhookResponse: webhookResult.response,
          submissionTime: new Date(),
        },
      });

      return { success: true, leadId: lead.id };
    } else {
      await storage.updateLead(lead.id, {
        status: "failed",
      });

      await storage.createAgentActivity({
        agentType: "lead_packaging",
        action: "dealer_crm_failed",
        description: `Dealer CRM submission failed: ${webhookResult.error}`,
        targetId: leadPackage.leadId,
        metadata: {
          error: webhookResult.error,
          leadId: lead.id,
        },
      });

      return { success: false, error: webhookResult.error };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
