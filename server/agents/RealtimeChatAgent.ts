import { Agent, tool } from "@openai/agents";
import { storage } from "../storage";
import { validatePartialPii, validateCompletePii } from "../../shared/validation/schemas";
import { logger } from "../logger";
import type { InsertChatSession } from "@shared/schema";
import {
  CATHY_SYSTEM_PROMPT,
  CATHY_PERSONA_CONFIG,
  INTERACTION_TEMPLATES,
} from "./cathy-system-prompt";
import {
  formatResponseByTone,
  personalizeGreeting,
  generateNextStepGuidance,
} from "./cathy-response-formatter";

export interface ChatMessage {
  id: string;
  type: "user" | "agent";
  content: string;
  timestamp: Date;
}

export class RealtimeChatAgent {
  private agent: Agent;
  private logger = logger.child({ component: 'RealtimeChatAgent' });

  constructor() {
    this.agent = new Agent({
      name: `${CATHY_PERSONA_CONFIG.name} - ${CATHY_PERSONA_CONFIG.role}`,
      instructions: CATHY_SYSTEM_PROMPT,
      tools: [
        this.createCheckPiiCompletenessTool(),
        this.createCollectPiiTool(),
        this.createTriggerLeadPackagingTool(),
        this.createHandleUserMessageTool(),
        this.createHandoffToCreditCheckTool(),
        this.createRecoverAbandonedApplicationTool(),
      ],
    });
  }

  private createCheckPiiCompletenessTool() {
    return tool({
      name: "check_pii_completeness",
      description: "Check if visitor has complete PII for lead packaging",
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

          // Extract current PII
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

          // Check completeness
          const validation = validatePartialPii(piiData);
          const completeValidation = validateCompletePii(piiData);

          this.logger.info('PII completeness check', {
            visitorId,
            piiComplete: completeValidation.isValid,
            missingFields: validation.missingFields
          });

          return {
            success: true,
            piiComplete: completeValidation.isValid,
            missingFields: validation.missingFields || [],
            currentPii: piiData,
            message: completeValidation.isValid 
              ? "Customer has complete PII - ready for lead packaging" 
              : `Missing fields: ${validation.missingFields?.join(', ')}`
          };

        } catch (error) {
          this.logger.error('PII completeness check error', {
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

  private createCollectPiiTool() {
    return tool({
      name: "collect_pii",
      description: "Collect and update visitor PII information progressively",
      execute: async (params: {
        visitorId: number;
        piiData: {
          firstName?: string;
          lastName?: string;
          street?: string;
          city?: string;
          state?: string;
          zip?: string;
          employer?: string;
          jobTitle?: string;
          annualIncome?: number;
          timeOnJobMonths?: number;
          email?: string;
        };
      }) => {
        try {
          const { visitorId, piiData } = params;

          // Validate the incoming PII data
          const validation = validatePartialPii(piiData);
          if (!validation.isValid) {
            return {
              success: false,
              error: `Invalid PII data: ${JSON.stringify(validation.errors)}`
            };
          }

          // Update visitor with new PII
          await storage.updateVisitor(visitorId, validation.data);

          // Check if PII is now complete
          const updatedVisitor = await storage.getVisitor(visitorId);
          if (!updatedVisitor) {
            throw new Error('Failed to retrieve updated visitor');
          }

          const completePiiData = {
            firstName: updatedVisitor.firstName,
            lastName: updatedVisitor.lastName,
            street: updatedVisitor.street,
            city: updatedVisitor.city,
            state: updatedVisitor.state,
            zip: updatedVisitor.zip,
            employer: updatedVisitor.employer,
            jobTitle: updatedVisitor.jobTitle,
            annualIncome: updatedVisitor.annualIncome,
            timeOnJobMonths: updatedVisitor.timeOnJobMonths,
            phoneNumber: updatedVisitor.phoneNumber,
            email: updatedVisitor.email,
            emailHash: updatedVisitor.emailHash
          };

          const completeValidation = validateCompletePii(completePiiData);

          this.logger.info('PII collected and updated', {
            visitorId,
            fieldsUpdated: Object.keys(piiData),
            piiComplete: completeValidation.isValid
          });

          return {
            success: true,
            piiComplete: completeValidation.isValid,
            updatedFields: Object.keys(piiData),
            missingFields: completeValidation.isValid ? [] : validatePartialPii(completePiiData).missingFields || [],
            message: completeValidation.isValid 
              ? "PII collection complete - ready for lead packaging!"
              : "PII updated successfully - still collecting additional information"
          };

        } catch (error) {
          this.logger.error('PII collection error', {
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

  private createTriggerLeadPackagingTool() {
    return tool({
      name: "trigger_lead_packaging",
      description: "Trigger lead packaging when PII collection is complete",
      execute: async (params: { visitorId: number; source?: string }) => {
        try {
          const { visitorId, source = 'chat_pii_complete' } = params;

          // Verify PII is complete before triggering
          const visitor = await storage.getVisitor(visitorId);
          if (!visitor) {
            return {
              success: false,
              error: "Visitor not found"
            };
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
          if (!validation.isValid) {
            return {
              success: false,
              piiComplete: false,
              error: "PII not complete - cannot trigger lead packaging"
            };
          }

          // Log the trigger event
          await storage.createAgentActivity({
            agentType: "realtime_chat",
            action: "lead_packaging_triggered",
            description: "Cathy triggered lead packaging after PII collection completion",
            targetId: visitorId.toString(),
            metadata: {
              source,
              piiComplete: true,
              triggeredAt: new Date()
            }
          });

          this.logger.info('Lead packaging triggered by chat agent', {
            visitorId,
            source,
            piiComplete: true
          });

          return {
            success: true,
            piiComplete: true,
            leadPackagingTriggered: true,
            message: "PII collection complete - lead packaging has been triggered!"
          };

        } catch (error) {
          this.logger.error('Lead packaging trigger error', {
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

  private createHandleUserMessageTool() {
    return tool({
      name: "handle_user_message",
      description: "Process and respond to user messages with Cathy's empathetic personality and PII collection",
      execute: async (params: { sessionId: string; message: string; visitorId?: number }) => {
        try {
          const { sessionId, message, visitorId } = params;

          // Get or create chat session
          let chatSession = await storage.getChatSessionBySessionId(sessionId);
          if (!chatSession) {
            const newSession: InsertChatSession = {
              sessionId,
              visitorId: visitorId || null,
              agentType: "realtime_chat",
              status: "active",
              messages: [],
            };
            chatSession = await storage.createChatSession(newSession);
          }

          // Analyze conversation context
          const messages = (chatSession.messages as ChatMessage[]) || [];
          const isFirstMessage = messages.filter(m => m.type === "user").length === 0;

          // Check for phone number
          const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
          const phoneMatch = message.match(phoneRegex);

          // Enhanced analysis for PII extraction
          const piiExtracted = this.extractPiiFromMessage(message);
          const shouldCollectPii = Object.keys(piiExtracted).length > 0;

          let response = "";
          let shouldHandoff = false;
          let piiCollected = false;
          let leadPackagingTriggered = false;

          if (phoneMatch) {
            response = this.generatePhoneNumberResponse();
            shouldHandoff = true;
          } else if (shouldCollectPii && visitorId) {
            // Collect PII and update visitor
            const collectResult = await this.collectPii(visitorId, piiExtracted);
            piiCollected = collectResult.success;
            
            if (collectResult.piiComplete) {
              // Trigger lead packaging
              const triggerResult = await this.triggerLeadPackaging(visitorId, 'chat_conversation');
              leadPackagingTriggered = triggerResult.success;
              response = this.generatePiiCompleteResponse(collectResult.updatedFields || []);
            } else {
              response = this.generatePiiCollectionResponse(piiExtracted, collectResult.missingFields || []);
            }
          } else if (isFirstMessage) {
            response = this.generateWelcomeResponse(message);
          } else {
            response = await this.generateContextualResponse(message, messages, visitorId);
          }

          return {
            success: true,
            response,
            shouldHandoff,
            piiCollected,
            leadPackagingTriggered,
            phoneNumber: phoneMatch ? phoneMatch[0] : null,
            sessionId,
          };
        } catch (error) {
          this.logger.error("Error handling user message", {
            sessionId: params.sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            response:
              "I'm so sorry, but I'm experiencing some technical difficulties right now. This is frustrating for both of us! Could you give me just a moment to get this sorted out?",
          };
        }
      },
    });
  }

  /**
   * Extract PII information from user message using natural language patterns
   */
  private extractPiiFromMessage(message: string): any {
    const extracted: any = {};
    const lowerMsg = message.toLowerCase();

    // Name extraction
    const namePatterns = [
      /my name is ([a-z]+)\\s+([a-z]+)/i,
      /i'm ([a-z]+)\\s+([a-z]+)/i,
      /i am ([a-z]+)\\s+([a-z]+)/i,
      /call me ([a-z]+)/i
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        if (match[2]) {
          extracted.firstName = match[1];
          extracted.lastName = match[2];
        } else {
          extracted.firstName = match[1];
        }
        break;
      }
    }

    // Email extraction
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/;
    const emailMatch = message.match(emailPattern);
    if (emailMatch) {
      extracted.email = emailMatch[1].toLowerCase();
    }

    // Address extraction
    const addressPatterns = [
      /i live at ([^,]+),\\s*([^,]+),\\s*([A-Z]{2})\\s*(\\d{5})/i,
      /my address is ([^,]+),\\s*([^,]+),\\s*([A-Z]{2})\\s*(\\d{5})/i,
      /address: ([^,]+),\\s*([^,]+),\\s*([A-Z]{2})\\s*(\\d{5})/i
    ];

    for (const pattern of addressPatterns) {
      const match = message.match(pattern);
      if (match) {
        extracted.street = match[1].trim();
        extracted.city = match[2].trim();
        extracted.state = match[3].toUpperCase();
        extracted.zip = match[4];
        break;
      }
    }

    // ZIP code extraction (standalone)
    if (!extracted.zip) {
      const zipPattern = /\\b(\\d{5}(?:-\\d{4})?)\\b/;
      const zipMatch = message.match(zipPattern);
      if (zipMatch) {
        extracted.zip = zipMatch[1];
      }
    }

    // Employment information
    const employerPatterns = [
      /i work at ([^,\\.]+)/i,
      /my employer is ([^,\\.]+)/i,
      /work for ([^,\\.]+)/i,
      /employed at ([^,\\.]+)/i,
      /company is ([^,\\.]+)/i
    ];

    for (const pattern of employerPatterns) {
      const match = message.match(pattern);
      if (match) {
        extracted.employer = match[1].trim();
        break;
      }
    }

    // Job title extraction
    const jobTitlePatterns = [
      /i'm a ([^,\\.]+)/i,
      /i am a ([^,\\.]+)/i,
      /job title is ([^,\\.]+)/i,
      /i work as a ([^,\\.]+)/i,
      /my position is ([^,\\.]+)/i
    ];

    for (const pattern of jobTitlePatterns) {
      const match = message.match(pattern);
      if (match) {
        extracted.jobTitle = match[1].trim();
        break;
      }
    }

    // Income extraction
    const incomePatterns = [
      /make \\$([\\d,]+)\\s*(?:per year|annually|a year)/i,
      /income is \\$([\\d,]+)/i,
      /salary is \\$([\\d,]+)/i,
      /earn \\$([\\d,]+)/i,
      /\\$([\\d,]+)\\s*(?:per year|annually)/i
    ];

    for (const pattern of incomePatterns) {
      const match = message.match(pattern);
      if (match) {
        const income = parseInt(match[1].replace(/,/g, ''));
        if (income > 10000 && income < 1000000) { // Reasonable range
          extracted.annualIncome = income;
        }
        break;
      }
    }

    // Time on job extraction
    const timePatterns = [
      /been there for (\\d+)\\s*years?/i,
      /worked there for (\\d+)\\s*years?/i,
      /(\\d+)\\s*years at/i,
      /been employed for (\\d+)\\s*months?/i
    ];

    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        const time = parseInt(match[1]);
        if (pattern.source.includes('year')) {
          extracted.timeOnJobMonths = time * 12;
        } else {
          extracted.timeOnJobMonths = time;
        }
        break;
      }
    }

    return extracted;
  }

  /**
   * Generate PII-guided response based on missing information
   */
  private async generateContextualResponse(message: string, conversationHistory: ChatMessage[], visitorId?: number): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // If we have a visitor ID, check for PII gaps and prompt accordingly
    if (visitorId) {
      try {
        // Check current PII status
        const visitor = await storage.getVisitor(visitorId);
        if (visitor) {
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

          const validation = validatePartialPii(piiData);
          const missingFields = validation.missingFields || [];

          // If missing fields, generate PII collection prompt
          if (missingFields.length > 0) {
            return this.generateMissingPiiPrompt(missingFields, message);
          }
        }
      } catch (error) {
        this.logger.error('Error checking PII for contextual response', { visitorId, error });
      }
    }

    // Default contextual responses
    if (lowerMsg.includes("confused") || lowerMsg.includes("don't understand")) {
      return formatResponseByTone(
        "negative",
        "I can absolutely see how this might feel overwhelming - car financing can seem complicated, but it doesn't have to be! Let me break this down in simple terms for you. Think of me as your personal guide through this process. What specific part would you like me to explain more clearly?"
      );
    }

    if (lowerMsg.includes("worried") || lowerMsg.includes("nervous") || lowerMsg.includes("scared")) {
      return formatResponseByTone(
        "negative",
        "Those feelings are completely normal, and I appreciate you sharing that with me. Many of my customers felt exactly the same way when they first reached out. The good news? You've already taken the hardest step by starting this conversation. I'm going to walk you through everything step by step, and there are no surprises or pressure here. What's your biggest worry right now?"
      );
    }

    if (lowerMsg.includes("rate") || lowerMsg.includes("payment") || lowerMsg.includes("monthly")) {
      return formatResponseByTone(
        "positive",
        "That's exactly the right question to ask! Your rate and payment will depend on a few factors like your credit profile, the vehicle you choose, and loan term. The great news is that our current rates start as low as 3.9% APR for qualified customers, and we have programs for all credit situations. Our soft credit check takes just a moment and won't impact your score at all. Would you like me to check what specific rate and payment you'd qualify for?"
      );
    }

    return formatResponseByTone(
      "progress",
      "I want to make sure I'm giving you exactly the help you need. Every customer's situation is unique, and I believe in taking the time to understand yours. Our soft credit check process is completely free and won't impact your credit score - it just helps me see what options will work best for you. What would be most helpful for you to know right now?"
    );
  }

  /**
   * Generate prompts for missing PII fields
   */
  private generateMissingPiiPrompt(missingFields: string[], userMessage: string): string {
    const lowerMsg = userMessage.toLowerCase();
    
    // Prioritize fields based on conversation context
    let priorityField = missingFields[0];
    
    // If user mentions specific topics, prioritize related fields
    if (lowerMsg.includes('work') || lowerMsg.includes('job') || lowerMsg.includes('employ')) {
      const workFields = missingFields.filter(f => ['employer', 'jobTitle', 'annualIncome', 'timeOnJobMonths'].includes(f));
      if (workFields.length > 0) priorityField = workFields[0];
    }
    
    if (lowerMsg.includes('address') || lowerMsg.includes('live') || lowerMsg.includes('zip')) {
      const addressFields = missingFields.filter(f => ['street', 'city', 'state', 'zip'].includes(f));
      if (addressFields.length > 0) priorityField = addressFields[0];
    }

    const fieldPrompts = {
      firstName: "I'd love to personalize this for you! What's your first name?",
      lastName: "And what's your last name?",
      street: "To get you the best rates, I'll need your street address. What's your current address?",
      city: "What city do you live in?",
      state: "Which state are you in?",
      zip: "And what's your ZIP code?",
      employer: "For the loan application, I'll need to know where you work. What's your current employer?",
      jobTitle: "What's your job title or position?",
      annualIncome: "What's your annual income? This helps me find the best loan options for you.",
      timeOnJobMonths: "How long have you been working at your current job?",
      email: "I'd like to send you some information - what's your email address?"
    };

    const prompt = fieldPrompts[priorityField as keyof typeof fieldPrompts] || 
      "I just need a bit more information to help you get the best loan terms.";

    // Add context about why we need the information
    const context = this.getPiiContextExplanation(priorityField);
    
    return formatResponseByTone('progress', `${prompt} ${context}`);
  }

  /**
   * Explain why we need specific PII information
   */
  private getPiiContextExplanation(field: string): string {
    const explanations = {
      firstName: "This helps me give you a more personal experience!",
      lastName: "I want to make sure I have your complete name for the application.",
      street: "Lenders need your complete address to verify your identity and determine local regulations.",
      city: "This helps me find lenders that work in your area.",
      state: "Different states have different lending regulations, so this helps me find the right options.",
      zip: "Your ZIP code helps me find local dealerships and the best rates in your area.",
      employer: "Employment verification is required for auto loans - this shows lenders you have steady income.",
      jobTitle: "Your job title helps lenders understand your income stability.",
      annualIncome: "This is probably the most important factor in determining your loan amount and interest rate.",
      timeOnJobMonths: "Lenders like to see employment stability - longer tenure often means better rates!",
      email: "I'll use this to send you your pre-approval letter and keep you updated on your application."
    };

    return explanations[field as keyof typeof explanations] || 
      "This information helps me get you pre-approved with the best possible terms.";
  }

  /**
   * Generate response when PII is collected
   */
  private generatePiiCollectionResponse(extractedPii: any, stillMissingFields: string[]): string {
    const collectedFields = Object.keys(extractedPii);
    let response = "Perfect! ";
    
    if (collectedFields.includes('firstName') && collectedFields.includes('lastName')) {
      response += `Thank you, ${extractedPii.firstName}! `;
    }
    
    if (collectedFields.includes('employer')) {
      response += `Great to know you work at ${extractedPii.employer}. `;
    }
    
    if (collectedFields.includes('annualIncome')) {
      response += `With your income level, you should have some excellent financing options! `;
    }

    if (stillMissingFields.length > 0) {
      const nextField = stillMissingFields[0];
      response += this.generateMissingPiiPrompt([nextField], '');
    } else {
      response += "I have everything I need now! Let me get your financing options ready.";
    }

    return formatResponseByTone('progress', response);
  }

  /**
   * Generate response when PII collection is complete
   */
  private generatePiiCompleteResponse(updatedFields: string[]): string {
    return formatResponseByTone('positive', 
      "Excellent! I now have all the information I need to get you pre-approved. " +
      "You're going to love how quickly this works - I'm processing your application right now and " +
      "should have your financing options ready in just a moment. " +
      "This is the exciting part where we turn your car dreams into reality!"
    );
  }

  /**
   * Helper methods for tool integration
   */
  private async collectPii(visitorId: number, piiData: any) {
    try {
      const validation = validatePartialPii(piiData);
      if (!validation.isValid) {
        return { success: false, error: 'Invalid PII data' };
      }

      await storage.updateVisitor(visitorId, validation.data);
      
      // Check completeness
      const updatedVisitor = await storage.getVisitor(visitorId);
      if (!updatedVisitor) {
        return { success: false, error: 'Failed to retrieve updated visitor' };
      }

      const completePiiData = {
        firstName: updatedVisitor.firstName,
        lastName: updatedVisitor.lastName,
        street: updatedVisitor.street,
        city: updatedVisitor.city,
        state: updatedVisitor.state,
        zip: updatedVisitor.zip,
        employer: updatedVisitor.employer,
        jobTitle: updatedVisitor.jobTitle,
        annualIncome: updatedVisitor.annualIncome,
        timeOnJobMonths: updatedVisitor.timeOnJobMonths,
        phoneNumber: updatedVisitor.phoneNumber,
        email: updatedVisitor.email,
        emailHash: updatedVisitor.emailHash
      };

      const completeValidation = validateCompletePii(completePiiData);
      const partialValidation = validatePartialPii(completePiiData);

      return {
        success: true,
        piiComplete: completeValidation.isValid,
        updatedFields: Object.keys(piiData),
        missingFields: partialValidation.missingFields || []
      };

    } catch (error) {
      this.logger.error('PII collection helper error', { visitorId, error });
      return { success: false, error: 'Failed to collect PII' };
    }
  }

  private async triggerLeadPackaging(visitorId: number, source: string) {
    try {
      await storage.createAgentActivity({
        agentType: "realtime_chat",
        action: "lead_packaging_triggered",
        description: "Cathy triggered lead packaging after PII collection completion",
        targetId: visitorId.toString(),
        metadata: {
          source,
          piiComplete: true,
          triggeredAt: new Date()
        }
      });

      this.logger.info('Lead packaging triggered', { visitorId, source });
      return { success: true };
    } catch (error) {
      this.logger.error('Lead packaging trigger error', { visitorId, error });
      return { success: false };
    }
  }

  private generateWelcomeResponse(message: string): string {
    const lowerMsg = message.toLowerCase();

    // Detect emotional tone and respond with empathy
    if (
      lowerMsg.includes("frustrated") ||
      lowerMsg.includes("denied") ||
      lowerMsg.includes("rejected")
    ) {
      return formatResponseByTone(
        "negative",
        "I completely understand how frustrating that experience must have been. You're not alone in this - I work specifically with people in all credit situations, and I've helped many customers who felt exactly like you do right now. Let's see what options we can explore together. What's been your biggest concern about getting approved?"
      );
    }

    if (
      lowerMsg.includes("urgent") ||
      lowerMsg.includes("need asap") ||
      lowerMsg.includes("quickly")
    ) {
      return formatResponseByTone(
        "progress",
        "I hear the urgency in your message, and I'm here to help you move quickly. I specialize in getting people pre-approved efficiently, often within minutes. Our soft credit check won't impact your score, and we work with all credit situations. What's driving the timeline - did you find a vehicle you love?"
      );
    }

    if (
      lowerMsg.includes("bad credit") ||
      lowerMsg.includes("poor credit") ||
      lowerMsg.includes("credit problems")
    ) {
      return formatResponseByTone(
        "positive",
        "I'm so glad you reached out! I want you to know that I work exclusively with customers in all credit situations - that's exactly my specialty. Many of my most successful customers started exactly where you are. Credit challenges don't define your options; they just help me find the right path for you. What kind of vehicle are you hoping to get?"
      );
    }

    // Default warm welcome using Cathy templates
    return (
      INTERACTION_TEMPLATES.firstContact.greeting.replace("{name}", "there") +
      "\n\n" +
      INTERACTION_TEMPLATES.firstContact.followUp
    );
  }

  private generatePhoneNumberResponse(): string {
    return formatResponseByTone(
      "progress",
      "Perfect! Thank you for trusting me with that information. I'm starting your soft credit check right now - this will just take a moment and won't impact your credit score at all. I'm really excited to see what great options we can get you approved for! You're taking exactly the right step here."
    );
  }

  private createHandoffToCreditCheckTool() {
    return tool({
      name: "handoff_to_credit_check",
      description: "Hand off to credit check agent with warm transition",
      execute: async (params: { sessionId: string; phoneNumber: string; visitorId?: number }) => {
        try {
          const { sessionId, phoneNumber, visitorId } = params;

          // Update chat session status
          const chatSession = await storage.getChatSessionBySessionId(sessionId);
          if (chatSession) {
            await storage.updateChatSession(chatSession.id, {
              status: "completed",
              agentType: "credit_check_handoff",
            });
          }

          // Update visitor with phone number if we have visitor ID
          if (visitorId) {
            await storage.updateVisitor(visitorId, {
              phoneNumber: this.formatPhoneNumber(phoneNumber),
            });
          }

          // Log handoff activity
          await storage.createAgentActivity({
            agentType: "realtime_chat",
            action: "handoff_to_credit_check",
            description: "Cathy successfully connected customer to credit check with warm handoff",
            targetId: sessionId,
            metadata: {
              phoneNumber: this.formatPhoneNumber(phoneNumber),
              visitorId,
            },
          });

          this.logger.info('Credit check handoff completed', {
            sessionId,
            phoneNumber: this.formatPhoneNumber(phoneNumber),
            visitorId
          });

          return {
            success: true,
            handoffComplete: true,
            phoneNumber: this.formatPhoneNumber(phoneNumber),
            message: "Warm handoff to credit check completed",
          };
        } catch (error) {
          this.logger.error("Error during credit check handoff", {
            sessionId: params.sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  private createRecoverAbandonedApplicationTool() {
    return tool({
      name: "recover_abandoned_application",
      description: "Help recover an abandoned application with empathy and understanding",
      execute: async (params: { returnToken?: string; emailHash?: string }) => {
        try {
          const { returnToken, emailHash } = params;

          let visitor = null;

          if (returnToken) {
            visitor = await storage.getVisitorByReturnToken(returnToken);
          } else if (emailHash) {
            visitor = await storage.getVisitorByEmailHash(emailHash);
          }

          if (!visitor) {
            return {
              success: false,
              message:
                "I'd love to help you find your application! Sometimes our system takes a moment to locate things. Could you provide your email address or phone number? I'll get you back on track right away.",
            };
          }

          // Check if return token is expired
          if (returnToken && visitor.returnTokenExpiry && new Date() > visitor.returnTokenExpiry) {
            return {
              success: false,
              message:
                "I see your return link has expired for security reasons - that's actually a good thing because it means your information is protected! No worries at all though. I can help you pick up right where you left off. Could you provide your phone number so I can locate your information?",
            };
          }

          const stepMessage = this.getEmpathethicRecoveryMessage(visitor.abandonmentStep || 1);

          // Log recovery activity
          await storage.createAgentActivity({
            agentType: "realtime_chat",
            action: "application_recovery",
            description: "Cathy provided empathetic application recovery assistance",
            targetId: visitor.id.toString(),
            metadata: {
              abandonmentStep: visitor.abandonmentStep,
              recoveryMethod: returnToken ? "return_token" : "email_hash",
            },
          });

          return {
            success: true,
            visitor,
            message: stepMessage,
            abandonmentStep: visitor.abandonmentStep,
          };
        } catch (error) {
          this.logger.error("Error recovering application", {
            returnToken,
            emailHash,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            message:
              "I'm having a little trouble accessing your information right now, but don't worry - this happens sometimes! Let me help you in a different way. I can get you set up fresh in just a couple of minutes, or if you prefer, I can connect you with one of our specialists. What would work better for you?",
          };
        }
      },
    });
  }

  private formatPhoneNumber(phone: string): string {
    // Convert to E.164 format
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+${cleaned}`;
    }
    return phone; // Return original if we can't format
  }

  private getEmpathethicRecoveryMessage(step: number): string {
    const messages = {
      1: "Welcome back! I'm so glad you decided to continue with us. I can see you were just getting started with your car loan application, and I want you to know that taking this step again shows real determination. Life gets busy, and sometimes we need to step away - that's completely normal. I'm here to make this as smooth as possible for you. Should we pick up right where you left off?",
      2: "It's wonderful to see you back! I can see you had already shared some information with us and were working on the vehicle details. I really appreciate you giving us another chance to help you. Sometimes the process can feel overwhelming, but you're doing great. Let me help you continue from exactly where you left off - no need to repeat anything you've already done.",
      3: "Welcome back! I'm thrilled you're ready to finish this up. I can see you were so close to completing everything - you had made it through most of the process already! That shows real commitment, and I'm confident we can get you approved. You're literally just steps away from having your financing in place. Should I help you complete the final verification steps right now?",
    };
    return messages[step as keyof typeof messages] || messages[1];
  }

  async handleChatMessage(
    sessionId: string,
    message: string,
    visitorId?: number
  ): Promise<{
    success: boolean;
    response: string;
    shouldHandoff?: boolean;
    piiCollected?: boolean;
    leadPackagingTriggered?: boolean;
    phoneNumber?: string;
    error?: string;
  }> {
    try {
      // Get or create chat session
      let chatSession = await storage.getChatSessionBySessionId(sessionId);
      if (!chatSession) {
        const newSession: InsertChatSession = {
          sessionId,
          visitorId: visitorId || null,
          agentType: "realtime_chat",
          status: "active",
          messages: [],
        };
        chatSession = await storage.createChatSession(newSession);
      }

      // Add user message to session
      const currentMessages = (chatSession.messages as ChatMessage[]) || [];
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: "user",
        content: message,
        timestamp: new Date(),
      };
      currentMessages.push(userMessage);

      // Generate empathetic response using personality system
      const isFirstMessage = currentMessages.filter(m => m.type === "user").length === 1;
      const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
      const phoneMatch = message.match(phoneRegex);

      // Extract PII from message
      const piiExtracted = this.extractPiiFromMessage(message);
      const shouldCollectPii = Object.keys(piiExtracted).length > 0;

      let response = "";
      let shouldHandoff = false;
      let piiCollected = false;
      let leadPackagingTriggered = false;

      if (phoneMatch) {
        response = this.generatePhoneNumberResponse();
        shouldHandoff = true;

        // Update visitor with phone number
        if (visitorId) {
          await storage.updateVisitor(visitorId, {
            phoneNumber: this.formatPhoneNumber(phoneMatch[0]),
          });
        }
      } else if (shouldCollectPii && visitorId) {
        // Collect PII and update visitor
        const collectResult = await this.collectPii(visitorId, piiExtracted);
        piiCollected = collectResult.success;
        
        if (collectResult.piiComplete) {
          // Trigger lead packaging
          const triggerResult = await this.triggerLeadPackaging(visitorId, 'chat_conversation');
          leadPackagingTriggered = triggerResult.success;
          response = this.generatePiiCompleteResponse(collectResult.updatedFields || []);
        } else {
          response = this.generatePiiCollectionResponse(piiExtracted, collectResult.missingFields || []);
        }
      } else if (isFirstMessage) {
        response = this.generateWelcomeResponse(message);
      } else {
        response = await this.generateContextualResponse(message, currentMessages, visitorId);
      }

      // Add agent response to session
      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "agent",
        content: response,
        timestamp: new Date(),
      };
      currentMessages.push(agentMessage);

      // Update chat session
      await storage.updateChatSession(chatSession.id, {
        messages: currentMessages,
        updatedAt: new Date(),
      });

      this.logger.info('Chat message processed', {
        sessionId,
        visitorId,
        piiCollected,
        leadPackagingTriggered,
        shouldHandoff
      });

      return {
        success: true,
        response,
        shouldHandoff,
        piiCollected,
        leadPackagingTriggered,
        phoneNumber: phoneMatch ? this.formatPhoneNumber(phoneMatch[0]) : undefined,
      };
    } catch (error) {
      this.logger.error("Error handling chat message", {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        response:
          "I'm so sorry, but I'm experiencing some technical difficulties right now. This is frustrating for both of us! Could you give me just a moment to get this sorted out?",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
