import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import type { InsertChatSession } from '@shared/schema';

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
      name: 'Realtime Chat Agent',
      instructions: `
        You are a helpful car loan assistant for Complete Car Loans. Your role is to:
        1. Help visitors continue their abandoned loan applications
        2. Answer questions about loan products and rates
        3. Collect contact information for credit checks
        4. Guide users through the application process
        5. Hand off to credit check agent when phone number is provided
        
        Key behaviors:
        - Be friendly, professional, and helpful
        - Ask for phone number to perform credit check
        - Explain loan products clearly
        - Help recover abandoned applications using return tokens
        - Keep responses concise and actionable
        - Always offer to help with next steps
        
        When a user provides their phone number, immediately hand off to the credit check agent.
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
      description: 'Process and respond to user messages in the chat',
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

          // Analyze message for phone number
          const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
          const phoneMatch = message.match(phoneRegex);
          
          let response = '';
          let shouldHandoff = false;

          if (phoneMatch) {
            response = "Thank you for providing your phone number! I'm now connecting you with our credit check system to get you pre-approved. This will just take a moment...";
            shouldHandoff = true;
          } else if (message.toLowerCase().includes('abandon') || message.toLowerCase().includes('application')) {
            response = "I'd be happy to help you continue your car loan application! Can you provide your email address or phone number so I can look up your previous application?";
          } else if (message.toLowerCase().includes('rate') || message.toLowerCase().includes('interest')) {
            response = "Our current car loan rates start as low as 3.9% APR for qualified borrowers. Rates depend on your credit score, loan term, and vehicle. Would you like me to check what rate you qualify for? I'll just need your phone number to run a quick credit check.";
          } else if (message.toLowerCase().includes('help') || message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
            response = "Hello! I'm here to help you with your car loan. Whether you're looking to start a new application or continue an existing one, I can assist you. What can I help you with today?";
          } else {
            response = "I understand you're interested in a car loan. I can help you get pre-approved quickly! To provide you with the best rates and terms, I'll need to run a soft credit check. Can you please provide your phone number?";
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
            response: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
          };
        }
      },
    });
  }

  private createHandoffToCreditCheckTool() {
    return tool({
      name: 'handoff_to_credit_check',
      description: 'Hand off to credit check agent when phone number is provided',
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
            description: 'Chat session handed off to credit check agent',
            targetId: sessionId,
            metadata: { 
              phoneNumber: this.formatPhoneNumber(phoneNumber),
              visitorId,
            },
          });

          console.log(`[RealtimeChatAgent] Handed off session ${sessionId} to credit check`);
          
          return {
            success: true,
            handoffComplete: true,
            phoneNumber: this.formatPhoneNumber(phoneNumber),
            message: 'Handoff to credit check agent completed',
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
      description: 'Help recover an abandoned application using return token or email',
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
              message: "I couldn't find your application. Could you provide your email address or phone number?",
            };
          }

          // Check if return token is expired
          if (returnToken && visitor.returnTokenExpiry && new Date() > visitor.returnTokenExpiry) {
            return {
              success: false,
              message: "Your return link has expired for security reasons. I can help you start a new application or look up your information with your phone number.",
            };
          }

          const stepMessage = this.getRecoveryMessage(visitor.abandonmentStep || 1);
          
          // Log recovery activity
          await storage.createAgentActivity({
            agentType: 'realtime_chat',
            action: 'application_recovery',
            description: 'Helped recover abandoned application',
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
            message: "I'm having trouble accessing your application. Let me help you start fresh or find your information another way.",
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

  private getRecoveryMessage(step: number): string {
    const messages = {
      1: "Great! I found your application. You were just getting started with your car loan application. I can help you continue right where you left off. Would you like me to proceed?",
      2: "Perfect! I found your application. You had already provided some basic information and were working on the vehicle details. Shall we continue from where you left off?",
      3: "Excellent! I found your application. You were almost finished - just needed to complete the final verification steps. Let's get you approved! Should I continue with your application?",
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

      // Process message and generate response
      const phoneRegex = /(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
      const phoneMatch = message.match(phoneRegex);
      
      let response = '';
      let shouldHandoff = false;

      if (phoneMatch) {
        response = "Thank you for providing your phone number! I'm now connecting you with our credit check system to get you pre-approved. This will just take a moment...";
        shouldHandoff = true;
        
        // Update visitor with phone number
        if (visitorId) {
          await storage.updateVisitor(visitorId, {
            phoneNumber: this.formatPhoneNumber(phoneMatch[0]),
          });
        }
      } else if (message.toLowerCase().includes('abandon') || message.toLowerCase().includes('application')) {
        response = "I'd be happy to help you continue your car loan application! Can you provide your email address or phone number so I can look up your previous application?";
      } else if (message.toLowerCase().includes('rate') || message.toLowerCase().includes('interest')) {
        response = "Our current car loan rates start as low as 3.9% APR for qualified borrowers. Rates depend on your credit score, loan term, and vehicle. Would you like me to check what rate you qualify for? I'll just need your phone number to run a quick credit check.";
      } else if (message.toLowerCase().includes('help') || message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
        response = "Hello! I'm here to help you with your car loan. Whether you're looking to start a new application or continue an existing one, I can assist you. What can I help you with today?";
      } else {
        response = "I understand you're interested in a car loan. I can help you get pre-approved quickly! To provide you with the best rates and terms, I'll need to run a soft credit check. Can you please provide your phone number?";
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

      console.log(`[RealtimeChatAgent] Processed message for session: ${sessionId}`);
      
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
        response: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getAgent(): Agent {
    return this.agent;
  }
}
