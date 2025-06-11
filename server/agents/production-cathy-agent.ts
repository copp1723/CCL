// Remove dependency on @openai/agents
// import { Agent, tool } from "@openai/agents";

// Define Agent interface locally
interface Agent {
  name: string;
  instructions: string;
  tools: any[];
}
import { storage } from "../storage";
import type { InsertChatSession } from "@shared/schema";
import {
  CATHY_SYSTEM_PROMPT,
  CATHY_PERSONA_CONFIG,
  INTERACTION_TEMPLATES,
} from "./cathy-system-prompt";

export class ProductionCathyAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      name: `${CATHY_PERSONA_CONFIG.name} - ${CATHY_PERSONA_CONFIG.role}`,
      instructions: CATHY_SYSTEM_PROMPT,
      tools: [
        this.createChatResponseTool(),
        this.createEmailResponseTool(),
        this.createPhoneCollectionTool(),
      ],
    });
  }

  private createChatResponseTool() {
    return tool(
      {
        name: "generate_chat_response",
        description: "Generate empathetic, personalized chat responses for website visitors",
        parameters: {
          type: "object",
          properties: {
            userMessage: { type: "string", description: "The user's message" },
            customerName: { type: "string", description: "Customer name if known" },
            conversationHistory: { type: "string", description: "Previous conversation context" },
            customerSituation: {
              type: "string",
              description: "Credit situation or concerns if known",
            },
          },
          required: ["userMessage"],
        },
      },
      async (params: any) => {
        try {
          const response = await this.generateCathyResponseFromParams(params);

          return {
            watermark: "CCL",
            query_type: "reply_to_customer",
            analysis: this.analyzeCustomerState(params.userMessage),
            answer: response,
            sales_readiness: this.assessSalesReadiness(params.userMessage),
            required_fields: this.determineRequiredFields(params.userMessage),
          };
        } catch (error) {
          console.error("Chat response generation error:", error);
          return {
            watermark: "CCL",
            query_type: "reply_to_customer",
            analysis: "Error occurred during response generation",
            answer:
              "I apologize, but I'm having a technical issue right now. Let me connect you with a specialist who can help you immediately.",
            sales_readiness: "low",
          };
        }
      }
    );
  }

  private createEmailResponseTool() {
    return tool(
      {
        name: "generate_email_response",
        description: "Generate personalized email responses for lead re-engagement",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Customer name" },
            lastInteraction: {
              type: "string",
              description: "Last interaction or application step",
            },
            customerConcerns: {
              type: "string",
              description: "Known customer concerns or hesitations",
            },
            timeframe: { type: "string", description: "How long since last contact" },
          },
          required: ["customerName"],
        },
      },
      async params => {
        try {
          const emailContent = this.generateEmailContent(params);

          return {
            watermark: "CCL",
            insights: this.analyzeCustomerInsights(params),
            approach: this.determineEmotionalApproach(params),
            sales_readiness: this.assessEmailSalesReadiness(params),
            email: emailContent,
          };
        } catch (error) {
          console.error("Email response generation error:", error);
          return {
            watermark: "CCL",
            insights: "Error in email generation",
            approach: "Supportive follow-up required",
            sales_readiness: "low",
            email: {
              salutation: `Dear ${params.customerName || "Valued Customer"},`,
              subject: "Let's continue your auto financing journey",
              body: "I wanted to personally reach out to see how I can help with your auto financing needs. I'm here whenever you're ready to move forward.\\n\\nPlease feel free to call or reply to this email with any questions.",
              signoff: "Best regards,\\nCathy",
            },
          };
        }
      }
    );
  }

  private createPhoneCollectionTool() {
    return tool(
      {
        name: "collect_phone_for_credit_check",
        description: "Guide customer through phone number collection for soft credit check",
        parameters: {
          type: "object",
          properties: {
            customerReadiness: {
              type: "string",
              description: "Customer readiness level: low, medium, high",
            },
            concerns: { type: "string", description: "Any expressed concerns about credit check" },
          },
          required: ["customerReadiness"],
        },
      },
      async params => {
        try {
          const guidance = this.generatePhoneCollectionGuidance(params);

          return {
            watermark: "CCL",
            query_type: "reply_to_customer",
            analysis: `Customer readiness: ${params.customerReadiness}. Guiding toward credit check.`,
            answer: guidance,
            required_fields: {
              phone_number: {
                type: "string",
                required: true,
                validation: "US phone format",
                purpose: "Soft credit check - no impact to credit score",
              },
            },
          };
        } catch (error) {
          console.error("Phone collection guidance error:", error);
          return {
            watermark: "CCL",
            query_type: "reply_to_customer",
            analysis: "Error in phone collection process",
            answer:
              "I'd love to help you with a quick credit check. Could you share your phone number so I can get started? This won't impact your credit score at all.",
            required_fields: {
              phone_number: { type: "string", required: true },
            },
          };
        }
      }
    );
  }

  private async generateCathyResponseFromParams(params: any): Promise<string> {
    const message = params.userMessage.toLowerCase();

    // Credit anxiety response
    if (
      message.includes("credit") &&
      (message.includes("bad") || message.includes("poor") || message.includes("worried"))
    ) {
      return "I want you to know that credit challenges are exactly what I specialize in. Many of our most successful customers started with similar concerns. Credit history doesn't define your options - it just helps me find the right path for you. What kind of vehicle are you hoping to get?";
    }

    // Confusion or overwhelm
    if (
      message.includes("confused") ||
      message.includes("overwhelming") ||
      message.includes("don't understand")
    ) {
      return "I completely understand - car financing can feel complicated, but it doesn't have to be! Let me break this down in simple terms. Think of me as your personal guide through this process. What specific part would you like me to explain more clearly?";
    }

    // Interest in moving forward
    if (message.includes("interested") || message.includes("ready") || message.includes("apply")) {
      return "That's wonderful! I'm excited to help you find the perfect financing solution. To get started, I can do a quick, soft credit check that won't impact your credit score at all. This just helps me see what programs work best for your situation. Sound good?";
    }

    // General inquiry
    if (message.includes("hello") || message.includes("hi") || message.includes("help")) {
      const greeting = params.customerName
        ? INTERACTION_TEMPLATES.firstContact.greeting.replace("{name}", params.customerName)
        : INTERACTION_TEMPLATES.firstContact.greeting.replace("{name}", "there");

      return `${greeting}\n\n${INTERACTION_TEMPLATES.firstContact.followUp}`;
    }

    // Default empathetic response
    return "I'm here to help make your auto financing journey as smooth as possible. Every customer's situation is unique, and I work with all credit situations. What questions can I answer for you today?";
  }

  private generateEmailContent(params: any) {
    const timeBasedSubject = params.timeframe?.includes("week")
      ? "Quick follow-up on your auto financing"
      : "Let's continue your auto financing journey";

    let body = `I hope you're doing well! `;

    if (params.lastInteraction) {
      body += `It's been a bit since we talked about ${params.lastInteraction}, and I wanted to personally check in. `;
    }

    body += `I know these decisions take time, and that's completely normal.\\n\\n`;

    if (params.customerConcerns) {
      body += `I understand you mentioned concerns about ${params.customerConcerns}. I work with customers in all credit situations every day, and I'm confident we can find options that work for you.\\n\\n`;
    }

    body += `When you're ready to move forward, I'm here to help. We can start with a quick, no-impact credit check to see what programs are available for you. No pressure at all - just reply when it's convenient for you.`;

    return {
      salutation: `Dear ${params.customerName},`,
      subject: timeBasedSubject,
      body,
      signoff: "Best regards,\\nCathy",
    };
  }

  private generatePhoneCollectionGuidance(params: any): string {
    if (params.customerReadiness === "high") {
      return "Perfect! I can get your pre-qualification started right away. I'll just need your phone number to run a soft credit check - this won't impact your credit score at all, it just helps me see what financing options are available for you. What's the best number to reach you at?";
    }

    if (params.customerReadiness === "medium") {
      return "Great! To see what options we have for you, I can do a quick credit check that won't affect your credit score. I just need your phone number to get started. This is completely secure and just helps me find the best programs for your situation.";
    }

    // Low readiness
    return "I understand you might want to think about it, and that's perfectly fine. When you're ready, I can do a soft credit check using just your phone number - no impact to your credit score at all. This just shows us what financing options are available for you. Would you like me to explain how that works?";
  }

  private analyzeCustomerState(message: string): string {
    const emotional_indicators = {
      anxious: ["worried", "nervous", "scared", "concerned"],
      confused: ["confused", "overwhelmed", "don't understand", "complicated"],
      ready: ["ready", "interested", "apply", "start", "begin"],
      hesitant: ["maybe", "thinking", "not sure", "unsure"],
    };

    const lowerMessage = message.toLowerCase();

    for (const [state, indicators] of Object.entries(emotional_indicators)) {
      if (indicators.some(indicator => lowerMessage.includes(indicator))) {
        return `Customer appears ${state}. Responding with appropriate empathy and guidance.`;
      }
    }

    return "Customer engaged in general inquiry. Building trust and rapport.";
  }

  private assessSalesReadiness(message: string): string {
    const highReadiness = ["ready", "apply", "start", "interested", "yes"];
    const lowReadiness = ["maybe", "thinking", "not sure", "worried", "confused"];

    const lowerMessage = message.toLowerCase();

    if (highReadiness.some(word => lowerMessage.includes(word))) return "high";
    if (lowReadiness.some(word => lowerMessage.includes(word))) return "low";

    return "medium";
  }

  private determineRequiredFields(message: string): any {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("credit check") ||
      lowerMessage.includes("apply") ||
      lowerMessage.includes("ready")
    ) {
      return {
        phone_number: {
          type: "string",
          required: true,
          purpose: "Soft credit check - no impact to credit score",
        },
      };
    }

    return {};
  }

  private analyzeCustomerInsights(params: any): string {
    let insights = `Customer: ${params.customerName}. `;

    if (params.lastInteraction) {
      insights += `Last interaction: ${params.lastInteraction}. `;
    }

    if (params.customerConcerns) {
      insights += `Concerns: ${params.customerConcerns}. `;
    }

    if (params.timeframe) {
      insights += `Time since contact: ${params.timeframe}.`;
    }

    return insights;
  }

  private determineEmotionalApproach(params: any): string {
    if (params.customerConcerns) {
      return "Empathetic reassurance addressing specific concerns while building confidence";
    }

    if (params.timeframe?.includes("week")) {
      return "Gentle re-engagement with no pressure, focusing on customer readiness";
    }

    return "Warm, supportive approach building trust and offering assistance";
  }

  public async generateCathyResponse(message: string, sessionId: string): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // Detect emotional tone and respond with empathy
    if (
      lowerMsg.includes("frustrated") ||
      lowerMsg.includes("denied") ||
      lowerMsg.includes("rejected")
    ) {
      return "I completely understand how frustrating that experience must have been. You're not alone in this - I work specifically with people in all credit situations, and I've helped many customers who felt exactly like you do right now. Let's see what options we can explore together. What's been your biggest concern about getting approved?";
    }

    if (
      lowerMsg.includes("urgent") ||
      lowerMsg.includes("need asap") ||
      lowerMsg.includes("quickly")
    ) {
      return "I hear the urgency in your message, and I'm here to help you move quickly. I specialize in getting people pre-approved efficiently, often within minutes. Our soft credit check won't impact your score, and we work with all credit situations. What's driving the timeline - did you find a vehicle you love?";
    }

    if (
      lowerMsg.includes("bad credit") ||
      lowerMsg.includes("poor credit") ||
      lowerMsg.includes("credit problems")
    ) {
      return "I'm so glad you reached out! I want you to know that I work exclusively with customers in all credit situations - that's exactly my specialty. Many of my most successful customers started exactly where you are. Credit challenges don't define your options; they just help me find the right path for you. What kind of vehicle are you hoping to get?";
    }

    // Handle rate and payment inquiries
    if (lowerMsg.includes("rate") || lowerMsg.includes("payment") || lowerMsg.includes("monthly")) {
      return "That's exactly the right question to ask! Your rate and payment will depend on a few factors like your credit profile, the vehicle you choose, and loan term. The great news is that our current rates start as low as 3.9% APR for qualified customers, and we have programs for all credit situations. Our soft credit check takes just a moment and won't impact your score at all. Would you like me to check what specific rate and payment you'd qualify for?";
    }

    // Handle application/process questions
    if (
      lowerMsg.includes("apply") ||
      lowerMsg.includes("application") ||
      lowerMsg.includes("process")
    ) {
      return "I love that you're ready to move forward! The process is actually much simpler than most people expect. We start with a quick, soft credit check that won't affect your score, then I can show you exactly what you qualify for. The whole pre-approval usually takes less than 2 minutes. Once you're pre-approved, you'll know your exact buying power before you even look at vehicles. Should we get your pre-approval started?";
    }

    // Handle vehicle-specific questions
    if (
      lowerMsg.includes("car") ||
      lowerMsg.includes("truck") ||
      lowerMsg.includes("suv") ||
      lowerMsg.includes("vehicle")
    ) {
      return "It sounds like you're getting excited about your next vehicle - I love that energy! Whether you're looking at something specific or still exploring options, getting pre-approved first is always the smart move. It gives you real negotiating power and helps you shop with confidence. Plus, our financing often beats dealer rates. Have you been looking at anything particular, or are you still in the browsing stage?";
    }

    // Default warm welcome
    return "Hi there! I'm Cathy, your finance expert at Complete Car Loans. I specialize in helping customers like you find the best financing options, no matter your credit history. I'm here to make this process as easy as possible for you. What brings you here today - are you looking to get pre-approved for a vehicle, or do you have questions about our financing options?";
  }

  private assessEmailSalesReadiness(params: any): string {
    if (params.lastInteraction?.includes("application") && !params.customerConcerns) {
      return "high";
    }

    if (params.customerConcerns) {
      return "low";
    }

    return "medium";
  }

  async generateResponse(input: string, context?: any): Promise<any> {
    try {
      const response = await this.agent.run(input, {
        messages: context?.messages || [],
        tools: ["generate_chat_response"],
      });

      return response;
    } catch (error) {
      console.error("Cathy agent error:", error);
      return {
        watermark: "CCL",
        query_type: "reply_to_customer",
        analysis: "Technical issue occurred",
        answer:
          "I apologize for the technical difficulty. Let me connect you with a specialist right away who can help you with your auto financing needs.",
        sales_readiness: "low",
      };
    }
  }
}

export const productionCathyAgent = new ProductionCathyAgent();

// Standalone function for chat integration
export async function generateCathyResponse(message: string, sessionId: string): Promise<string> {
  return await productionCathyAgent.generateCathyResponse(message, sessionId);
}
