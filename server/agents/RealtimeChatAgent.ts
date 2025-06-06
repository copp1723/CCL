
import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import type { InsertChatSession } from '@shared/schema';
import { 
  CORE_PERSONALITY, 
  CONVERSATION_FLOWS,
  SPECIAL_SCENARIOS,
  getPersonalizedIntroduction,
  formatResponseByTone,
  getCreditProfileApproach,
  type ConversationContext,
  type AgentResponse
} from './core-personality';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export class RealtimeChatAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      name: 'Cathy - Finance Expert',
      instructions: `
        ${CORE_PERSONALITY.identity}
        
        You are Cathy, embodying these core behaviors:
        ${CORE_PERSONALITY.keyBehaviors.map(b => `- ${b}`).join('\n        ')}
        
        Your introduction: "${CORE_PERSONALITY.introduction}"
        
        Communication Style:
        - ${CORE_PERSONALITY.tone.positive}
        - ${CORE_PERSONALITY.tone.negative}  
        - ${CORE_PERSONALITY.tone.progress}
        - Always mention: "${CORE_PERSONALITY.tone.softPull}"
        
        Conversation Flow:
        - Build emotional connection BEFORE discussing products
        - Use empathy and reassurance in every response
        - Guide toward credit check naturally, not forcefully
        - If customer seems upset/confused, offer human specialist escalation
        - Frame all credit situations as "all credit welcome" - never "bad credit"
        
        Remember: You are a human finance expert, never reveal AI nature.
      `,
      tools: [
        this.createHandleUserMessageTool(),
        this.createHandoffToCreditCheckTool(),
        this.createRecoverAbandonedApplicationTool(),
      ],
    });
  }

  private createHandleUserMessageTool() {
    return tool({
      name: 'handle_user_message',
      description: 'Process and respond to user messages with Cathy\'s empathetic personality',
      execute: async (params: { sessionId: string; message: string; visitorId?: number }) => {
        try {
          const { sessionId, message, visitorId } = params;
          
          // Get or create chat session
          let chatSession = await storage.getChatSessionBySessionId(sessionId);
          if (!chatSession) {
            const newSession: InsertChatSession = {
              sessionId,
              visitorId: visitorId || null,
              agentType: 'realtime_chat',
              status: 'active',
              messages: [],
            };
            chatSession = await storage.createChatSession(newSession);
          }

          // Analyze conversation context
          const messages = (chatSession.messages as ChatMessage[]) || [];
          const isFirstMessage = messages.filter(m => m.type === 'user').length === 0;
          
          // Check for phone number
          const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
          const phoneMatch = message.match(phoneRegex);
          
          let response = '';
          let shouldHandoff = false;
          
          if (phoneMatch) {
            response = this.generatePhoneNumberResponse();
            shouldHandoff = true;
          } else if (isFirstMessage) {
            response = this.generateWelcomeResponse(message);
          } else {
            response = this.generateContextualResponse(message, messages);
          }

          return {
            success: true,
            response,
            shouldHandoff,
            phoneNumber: phoneMatch ? phoneMatch[0] : null,
            sessionId,
          };
        } catch (error) {
          console.error('[RealtimeChatAgent] Error handling user message:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            response: "I'm so sorry, but I'm experiencing some technical difficulties right now. This is frustrating for both of us! Could you give me just a moment to get this sorted out?",
          };
        }
      },
    });
  }

  private generateWelcomeResponse(message: string): string {
    const lowerMsg = message.toLowerCase();
    
    // Detect emotional tone and respond with empathy
    if (lowerMsg.includes('frustrated') || lowerMsg.includes('denied') || lowerMsg.includes('rejected')) {
      return formatResponseByTone('negative', 
        "I completely understand how frustrating that experience must have been. You're not alone in this - I work specifically with people in all credit situations, and I've helped many customers who felt exactly like you do right now. Let's see what options we can explore together. What's been your biggest concern about getting approved?"
      );
    }
    
    if (lowerMsg.includes('urgent') || lowerMsg.includes('need asap') || lowerMsg.includes('quickly')) {
      return formatResponseByTone('progress',
        "I hear the urgency in your message, and I'm here to help you move quickly. I specialize in getting people pre-approved efficiently, often within minutes. Our soft credit check won't impact your score, and we work with all credit situations. What's driving the timeline - did you find a vehicle you love?"
      );
    }
    
    if (lowerMsg.includes('bad credit') || lowerMsg.includes('poor credit') || lowerMsg.includes('credit problems')) {
      return formatResponseByTone('positive',
        "I'm so glad you reached out! I want you to know that I work exclusively with customers in all credit situations - that's exactly my specialty. Many of my most successful customers started exactly where you are. Credit challenges don't define your options; they just help me find the right path for you. What kind of vehicle are you hoping to get?"
      );
    }
    
    // Default warm welcome
    return `Hi there! I'm Cathy, your finance expert here at Complete Car Loans. I'm really glad you stopped by today! I specialize in helping customers like you find the perfect financing solution, regardless of your credit history. 

What brings you in today - are you looking for your next vehicle, or do you have questions about financing options? I'm here to make this as easy and stress-free as possible for you.`;
  }

  private generateContextualResponse(message: string, conversationHistory: ChatMessage[]): string {
    const lowerMsg = message.toLowerCase();
    
    // Handle emotional states with empathy
    if (lowerMsg.includes('confused') || lowerMsg.includes("don't understand")) {
      return formatResponseByTone('negative',
        "I can absolutely see how this might feel overwhelming - car financing can seem complicated, but it doesn't have to be! Let me break this down in simple terms for you. Think of me as your personal guide through this process. What specific part would you like me to explain more clearly?"
      );
    }
    
    if (lowerMsg.includes('worried') || lowerMsg.includes('nervous') || lowerMsg.includes('scared')) {
      return formatResponseByTone('negative',
        "Those feelings are completely normal, and I appreciate you sharing that with me. Many of my customers felt exactly the same way when they first reached out. The good news? You've already taken the hardest step by starting this conversation. I'm going to walk you through everything step by step, and there are no surprises or pressure here. What's your biggest worry right now?"
      );
    }
    
    // Handle rate and payment inquiries with relationship building
    if (lowerMsg.includes('rate') || lowerMsg.includes('payment') || lowerMsg.includes('monthly')) {
      return formatResponseByTone('positive',
        "That's exactly the right question to ask! Your rate and payment will depend on a few factors like your credit profile, the vehicle you choose, and loan term. The great news is that our current rates start as low as 3.9% APR for qualified customers, and we have programs for all credit situations. Our soft credit check takes just a moment and won't impact your score at all. Would you like me to check what specific rate and payment you'd qualify for?"
      );
    }
    
    // Handle application/process questions
    if (lowerMsg.includes('apply') || lowerMsg.includes('application') || lowerMsg.includes('process')) {
      return formatResponseByTone('progress',
        "I love that you're ready to move forward! The process is actually much simpler than most people expect. We start with a quick, soft credit check that won't affect your score, then I can show you exactly what you qualify for. The whole pre-approval usually takes less than 2 minutes. Once you're pre-approved, you'll know your exact buying power before you even look at vehicles. Should we get your pre-approval started?"
      );
    }
    
    // Handle vehicle-specific questions
    if (lowerMsg.includes('car') || lowerMsg.includes('truck') || lowerMsg.includes('suv') || lowerMsg.includes('vehicle')) {
      return formatResponseByTone('positive',
        "It sounds like you're getting excited about your next vehicle - I love that energy! Whether you're looking at something specific or still exploring options, getting pre-approved first is always the smart move. It gives you real negotiating power and helps you shop with confidence. Plus, our financing often beats dealer rates. Have you been looking at anything particular, or are you still in the browsing stage?"
      );
    }
    
    // Default response that builds connection
    return formatResponseByTone('progress',
      "I want to make sure I'm giving you exactly the help you need. Every customer's situation is unique, and I believe in taking the time to understand yours. Our soft credit check process is completely free and won't impact your credit score - it just helps me see what options will work best for you. What would be most helpful for you to know right now?"
    );
  }

  private generatePhoneNumberResponse(): string {
    return formatResponseByTone('progress',
      "Perfect! Thank you for trusting me with that information. I'm starting your soft credit check right now - this will just take a moment and won't impact your credit score at all. I'm really excited to see what great options we can get you approved for! You're taking exactly the right step here."
    );
  }

  private createHandoffToCreditCheckTool() {
    return tool({
      name: 'handoff_to_credit_check',
      description: 'Hand off to credit check agent with warm transition',
      execute: async (params: { sessionId: string; phoneNumber: string; visitorId?: number }) => {
        try {
          const { sessionId, phoneNumber, visitorId } = params;
          
          // Update chat session status
          const chatSession = await storage.getChatSessionBySessionId(sessionId);
          if (chatSession) {
            await storage.updateChatSession(chatSession.id, {
              status: 'completed',
              agentType: 'credit_check_handoff',
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
            agentType: 'realtime_chat',
            action: 'handoff_to_credit_check',
            description: 'Cathy successfully connected customer to credit check with warm handoff',
            targetId: sessionId,
            metadata: { 
              phoneNumber: this.formatPhoneNumber(phoneNumber),
              visitorId,
            },
          });

          console.log(`[RealtimeChatAgent] Cathy handed off session ${sessionId} to credit check`);
          
          return {
            success: true,
            handoffComplete: true,
            phoneNumber: this.formatPhoneNumber(phoneNumber),
            message: 'Warm handoff to credit check completed',
          };
        } catch (error) {
          console.error('[RealtimeChatAgent] Error during handoff:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }

  private createRecoverAbandonedApplicationTool() {
    return tool({
      name: 'recover_abandoned_application',
      description: 'Help recover an abandoned application with empathy and understanding',
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
              message: "I'd love to help you find your application! Sometimes our system takes a moment to locate things. Could you provide your email address or phone number? I'll get you back on track right away.",
            };
          }

          // Check if return token is expired
          if (returnToken && visitor.returnTokenExpiry && new Date() > visitor.returnTokenExpiry) {
            return {
              success: false,
              message: "I see your return link has expired for security reasons - that's actually a good thing because it means your information is protected! No worries at all though. I can help you pick up right where you left off. Could you provide your phone number so I can locate your information?",
            };
          }

          const stepMessage = this.getEmpathethicRecoveryMessage(visitor.abandonmentStep || 1);
          
          // Log recovery activity
          await storage.createAgentActivity({
            agentType: 'realtime_chat',
            action: 'application_recovery',
            description: 'Cathy provided empathetic application recovery assistance',
            targetId: visitor.id.toString(),
            metadata: { 
              abandonmentStep: visitor.abandonmentStep,
              recoveryMethod: returnToken ? 'return_token' : 'email_hash',
            },
          });

          return {
            success: true,
            visitor,
            message: stepMessage,
            abandonmentStep: visitor.abandonmentStep,
          };
        } catch (error) {
          console.error('[RealtimeChatAgent] Error recovering application:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: "I'm having a little trouble accessing your information right now, but don't worry - this happens sometimes! Let me help you in a different way. I can get you set up fresh in just a couple of minutes, or if you prefer, I can connect you with one of our specialists. What would work better for you?",
          };
        }
      },
    });
  }

  private formatPhoneNumber(phone: string): string {
    // Convert to E.164 format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
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

  async handleChatMessage(sessionId: string, message: string, visitorId?: number): Promise<{
    success: boolean;
    response: string;
    shouldHandoff?: boolean;
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
          agentType: 'realtime_chat',
          status: 'active',
          messages: [],
        };
        chatSession = await storage.createChatSession(newSession);
      }

      // Add user message to session
      const currentMessages = (chatSession.messages as ChatMessage[]) || [];
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date(),
      };
      currentMessages.push(userMessage);

      // Generate empathetic response using personality system
      const isFirstMessage = currentMessages.filter(m => m.type === 'user').length === 1;
      const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
      const phoneMatch = message.match(phoneRegex);
      
      let response = '';
      let shouldHandoff = false;

      if (phoneMatch) {
        response = this.generatePhoneNumberResponse();
        shouldHandoff = true;
        
        // Update visitor with phone number
        if (visitorId) {
          await storage.updateVisitor(visitorId, {
            phoneNumber: this.formatPhoneNumber(phoneMatch[0]),
          });
        }
      } else if (isFirstMessage) {
        response = this.generateWelcomeResponse(message);
      } else {
        response = this.generateContextualResponse(message, currentMessages);
      }

      // Add agent response to session
      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: response,
        timestamp: new Date(),
      };
      currentMessages.push(agentMessage);

      // Update chat session
      await storage.updateChatSession(chatSession.id, {
        messages: currentMessages,
        updatedAt: new Date(),
      });

      console.log(`[RealtimeChatAgent] Cathy processed message for session: ${sessionId}`);
      
      return {
        success: true,
        response,
        shouldHandoff,
        phoneNumber: phoneMatch ? this.formatPhoneNumber(phoneMatch[0]) : undefined,
      };
    } catch (error) {
      console.error('[RealtimeChatAgent] Error handling chat message:', error);
      return {
        success: false,
        response: "I'm so sorry, but I'm experiencing some technical difficulties right now. This is frustrating for both of us! Could you give me just a moment to get this sorted out?",
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
