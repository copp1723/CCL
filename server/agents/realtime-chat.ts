import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { WebSocketManager } from '../services/websocket';

export const realtimeChatAgent = new Agent({
  name: 'RealtimeChatAgent',
  instructions: `
    You are a helpful AI assistant for Complete Car Loans, specializing in auto loan applications and customer support.
    
    Your role:
    1. Assist customers with auto loan applications in real-time
    2. Answer questions about rates, terms, and qualification requirements
    3. Help customers continue abandoned applications
    4. Collect phone numbers for credit checks when appropriate
    5. Provide immediate, helpful, and accurate responses
    
    Key capabilities:
    - Real-time chat with <1s response latency
    - Hand off to CreditCheckAgent when phone number is provided
    - Access to customer application history
    - Proactive assistance based on visitor context
    
    Conversation guidelines:
    - Be friendly, professional, and helpful
    - Ask clarifying questions to understand needs
    - Explain loan terms clearly and simply
    - Build trust through transparency
    - Request phone number naturally in conversation flow
    
    Handoff triggers:
    - Customer provides phone number
    - Customer asks about qualification/approval
    - Customer wants to check rates
  `,
});

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: {
    latency?: number;
    handoffTriggered?: boolean;
    creditCheckRequested?: boolean;
  };
}

export class RealtimeChatService {
  private wsManager: WebSocketManager;

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
  }

  async handleNewChatSession(sessionId: string, visitorId?: number): Promise<void> {
    try {
      // Create or get chat session
      let chatSession = await storage.getChatSessionBySessionId(sessionId);
      
      if (!chatSession) {
        chatSession = await storage.createChatSession({
          sessionId,
          visitorId,
          isActive: true,
          messages: [],
        });
      }

      // Send welcome message
      await this.sendWelcomeMessage(sessionId, visitorId);

      // Log activity
      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'chat_session_started',
        details: `New chat session ${sessionId}`,
        visitorId,
        status: 'success',
      });

    } catch (error) {
      console.error('Error handling new chat session:', error);
    }
  }

  async handleUserMessage(sessionId: string, content: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get chat session and visitor context
      const chatSession = await storage.getChatSessionBySessionId(sessionId);
      if (!chatSession) {
        throw new Error(`Chat session ${sessionId} not found`);
      }

      // Store user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        sessionId,
        sender: 'user',
        content,
        timestamp: new Date(),
      };

      await this.storeMessage(chatSession.id, userMessage);

      // Analyze message for handoff triggers
      const analysisResult = await this.analyzeMessage(content, chatSession);

      // Generate AI response
      const agentResponse = await this.generateAgentResponse(content, chatSession, analysisResult);

      // Store agent message
      const agentMessage: ChatMessage = {
        id: `msg_${Date.now()}_agent`,
        sessionId,
        sender: 'agent',
        content: agentResponse.content,
        timestamp: new Date(),
        metadata: {
          latency: Date.now() - startTime,
          handoffTriggered: analysisResult.shouldHandoff,
          creditCheckRequested: analysisResult.phoneNumberDetected,
        },
      };

      await this.storeMessage(chatSession.id, agentMessage);

      // Send response via WebSocket
      this.wsManager.sendToSession(sessionId, {
        type: 'agent_message',
        data: agentMessage,
      });

      // Handle handoffs if needed
      if (analysisResult.shouldHandoff && analysisResult.phoneNumber) {
        await this.triggerCreditCheckHandoff(sessionId, analysisResult.phoneNumber, chatSession.visitorId);
      }

      // Log performance metrics
      const latency = Date.now() - startTime;
      if (latency > 1000) {
        console.warn(`Chat response latency exceeded target: ${latency}ms`);
      }

    } catch (error) {
      console.error('Error handling user message:', error);
      
      // Send error response
      this.wsManager.sendToSession(sessionId, {
        type: 'agent_message',
        data: {
          id: `msg_${Date.now()}_error`,
          sessionId,
          sender: 'agent',
          content: "I'm sorry, I'm experiencing technical difficulties. Please try again or contact our support team.",
          timestamp: new Date(),
        },
      });
    }
  }

  private async sendWelcomeMessage(sessionId: string, visitorId?: number): Promise<void> {
    let welcomeContent = "Hi! I'm your CCL Assistant. I'm here to help you with your auto loan application. How can I assist you today?";

    // Personalize if returning visitor
    if (visitorId) {
      const visitor = await storage.getVisitor(visitorId);
      if (visitor?.abandonmentDetected) {
        welcomeContent = "Welcome back! I see you started an auto loan application with us. I'm here to help you complete it. Would you like to continue where you left off?";
      }
    }

    const welcomeMessage: ChatMessage = {
      id: `msg_${Date.now()}_welcome`,
      sessionId,
      sender: 'agent',
      content: welcomeContent,
      timestamp: new Date(),
    };

    this.wsManager.sendToSession(sessionId, {
      type: 'agent_message',
      data: welcomeMessage,
    });

    // Store welcome message
    const chatSession = await storage.getChatSessionBySessionId(sessionId);
    if (chatSession) {
      await this.storeMessage(chatSession.id, welcomeMessage);
    }
  }

  private async analyzeMessage(content: string, chatSession: any): Promise<{
    shouldHandoff: boolean;
    phoneNumberDetected: boolean;
    phoneNumber?: string;
    intent: string;
  }> {
    // Simple phone number detection
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    const phoneMatch = content.match(phoneRegex);
    
    const phoneNumberDetected = !!phoneMatch;
    const phoneNumber = phoneMatch ? phoneMatch[0] : undefined;

    // Intent analysis (simplified)
    const lowerContent = content.toLowerCase();
    let intent = 'general';
    
    if (lowerContent.includes('rate') || lowerContent.includes('apr') || lowerContent.includes('interest')) {
      intent = 'rates_inquiry';
    } else if (lowerContent.includes('qualify') || lowerContent.includes('approve') || lowerContent.includes('credit')) {
      intent = 'qualification_inquiry';
    } else if (lowerContent.includes('continue') || lowerContent.includes('finish') || lowerContent.includes('complete')) {
      intent = 'continue_application';
    }

    return {
      shouldHandoff: phoneNumberDetected && (intent === 'qualification_inquiry' || intent === 'rates_inquiry'),
      phoneNumberDetected,
      phoneNumber,
      intent,
    };
  }

  private async generateAgentResponse(content: string, chatSession: any, analysis: any): Promise<{ content: string }> {
    // In a real implementation, this would use the OpenAI Agents SDK
    // For now, using rule-based responses
    
    if (analysis.phoneNumberDetected) {
      return {
        content: "Great! I have your phone number. Let me run a quick credit check to get you personalized rates and terms. This will be a soft pull that won't affect your credit score. One moment please..."
      };
    }

    switch (analysis.intent) {
      case 'rates_inquiry':
        return {
          content: "I'd be happy to help you with current rates! Our auto loan rates start as low as 3.9% APR for qualified borrowers. To give you personalized rates, I'll need to run a quick credit check. Could you provide your phone number so I can get started?"
        };
      
      case 'qualification_inquiry':
        return {
          content: "Our qualification process is quick and easy! We work with borrowers across the credit spectrum. To check your qualification and get instant pre-approval, I'll need to verify your information. Could you share your phone number so I can run a soft credit check?"
        };
      
      case 'continue_application':
        return {
          content: "Absolutely! I can help you continue your application right where you left off. To verify your identity and pull up your information, could you provide the phone number you used on your original application?"
        };
      
      default:
        return {
          content: "I'm here to help with your auto loan needs! I can assist with questions about rates, qualification requirements, or help you complete an application. What would you like to know more about?"
        };
    }
  }

  private async storeMessage(chatSessionId: number, message: ChatMessage): Promise<void> {
    try {
      const chatSession = await storage.getChatSession(chatSessionId);
      if (!chatSession) return;

      const messages = Array.isArray(chatSession.messages) ? chatSession.messages : [];
      messages.push(message);

      await storage.updateChatSession(chatSessionId, {
        messages,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error storing message:', error);
    }
  }

  private async triggerCreditCheckHandoff(sessionId: string, phoneNumber: string, visitorId?: number): Promise<void> {
    try {
      // Import here to avoid circular dependency
      const { creditCheckService } = await import('./credit-check');
      
      // Trigger credit check
      await creditCheckService.performCreditCheck(phoneNumber, visitorId);

      // Notify user of handoff
      this.wsManager.sendToSession(sessionId, {
        type: 'handoff_initiated',
        data: {
          agent: 'CreditCheckAgent',
          message: 'Performing credit check...',
        },
      });

      // Log handoff
      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'handoff_to_credit_check',
        details: `Handed off to CreditCheckAgent for phone ${phoneNumber}`,
        visitorId,
        status: 'success',
      });

    } catch (error) {
      console.error('Error triggering credit check handoff:', error);
    }
  }

  async endChatSession(sessionId: string): Promise<void> {
    try {
      const chatSession = await storage.getChatSessionBySessionId(sessionId);
      if (!chatSession) return;

      await storage.updateChatSession(chatSession.id, {
        isActive: false,
        updatedAt: new Date(),
      });

      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'chat_session_ended',
        details: `Chat session ${sessionId} ended`,
        visitorId: chatSession.visitorId,
        status: 'success',
      });

    } catch (error) {
      console.error('Error ending chat session:', error);
    }
  }
}

export let realtimeChatService: RealtimeChatService;

export function initializeRealtimeChatService(wsManager: WebSocketManager) {
  realtimeChatService = new RealtimeChatService(wsManager);
}
