import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { generateSessionId } from '../utils/tokens';
import { isValidEmail, formatPhoneE164 } from '../utils/pii';
import type { ChatMessage } from '@shared/schema';
import EventEmitter from 'events';

export class RealtimeChatAgent extends EventEmitter {
  private agent: Agent;

  constructor() {
    super();
    
    this.agent = new Agent({
      name: 'RealtimeChatAgent',
      instructions: `
        You are the Realtime Chat Agent for Complete Car Loans, specialized in helping 
        customers with auto-loan applications via WebSocket chat. Your role is to:
        
        1. Provide instant, helpful responses about car loans and applications
        2. Guide users through the application process step-by-step
        3. Collect necessary information (email, phone) for credit checks
        4. Hand off to CreditCheckAgent when phone number is provided
        5. Maintain session state and conversation context
        6. Ensure response latency stays under 1 second (p95)
        
        Key Guidelines:
        - Be friendly, professional, and knowledgeable about auto loans
        - Ask for email and phone number to proceed with credit check
        - Validate phone numbers in E.164 format before handoff
        - Keep responses concise but informative
        - Handle common questions about rates, terms, and approval process
        - Escalate complex issues appropriately
        
        Common Topics:
        - Loan rates and terms
        - Credit score requirements
        - Application process
        - Required documentation
        - Dealer network information
        - Pre-approval benefits
      `,
    });
  }

  /**
   * Process incoming chat message
   */
  async processMessage(sessionId: string, userMessage: string, visitorId?: number): Promise<string> {
    try {
      const startTime = Date.now();
      
      console.log(`[RealtimeChatAgent] Processing message from session ${sessionId}`);

      // Get or create chat session
      let chatSession = await storage.getChatSession(sessionId);
      
      if (!chatSession) {
        chatSession = await storage.createChatSession({
          sessionId,
          visitorId: visitorId || null,
          isActive: true
        });
      }

      // Store user message
      await storage.createChatMessage({
        sessionId,
        role: 'user',
        content: userMessage
      });

      // Get conversation history for context
      const messageHistory = await storage.getChatMessages(sessionId);
      
      // Generate response using OpenAI Agent
      const response = await this.generateResponse(userMessage, messageHistory);

      // Store assistant response
      await storage.createChatMessage({
        sessionId,
        role: 'assistant',
        content: response
      });

      // Check if response contains handoff trigger
      await this.checkForHandoff(sessionId, userMessage, response, visitorId);

      // Log performance metrics
      const responseTime = Date.now() - startTime;
      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'message_processed',
        entityId: sessionId,
        entityType: 'chat_session',
        status: 'completed',
        metadata: { 
          responseTime,
          messageLength: userMessage.length,
          responseLength: response.length
        }
      });

      // Warn if response time exceeds target
      if (responseTime > 1000) {
        console.warn(`[RealtimeChatAgent] Response time ${responseTime}ms exceeds 1s target`);
      }

      return response;
    } catch (error) {
      console.error('[RealtimeChatAgent] Error processing message:', error);
      
      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'message_failed',
        entityId: sessionId,
        entityType: 'chat_session',
        status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return "I'm sorry, I'm having trouble processing your message right now. Please try again in a moment.";
    }
  }

  /**
   * Generate response using OpenAI Agent
   */
  private async generateResponse(message: string, history: ChatMessage[]): Promise<string> {
    try {
      // Format conversation context
      const context = history.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use simple pattern matching for now (in production would use full OpenAI Agents SDK)
      const response = this.generateContextualResponse(message, context);
      
      return response;
    } catch (error) {
      console.error('[RealtimeChatAgent] Error generating response:', error);
      return "I apologize, but I'm having trouble generating a response right now. How can I help you with your car loan application?";
    }
  }

  /**
   * Generate contextual response based on message patterns
   */
  private generateContextualResponse(message: string, context: any[]): string {
    const lowerMessage = message.toLowerCase();

    // Email collection
    if (this.extractEmail(message)) {
      return "Thank you for providing your email address! Now I'll need your phone number to proceed with a soft credit check. Please provide your phone number (including area code).";
    }

    // Phone number collection
    if (this.extractPhone(message)) {
      return "Perfect! I have your phone number. Let me initiate a soft credit check for you. This won't affect your credit score. Please give me a moment...";
    }

    // Greeting patterns
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return "Hello! Welcome to Complete Car Loans. I'm here to help you get pre-approved for your car loan. To get started, I'll need your email address and phone number for a quick soft credit check. What's your email address?";
    }

    // Rate inquiries
    if (lowerMessage.includes('rate') || lowerMessage.includes('interest') || lowerMessage.includes('apr')) {
      return "Our rates vary based on your credit profile, but we offer competitive rates starting as low as 3.5% APR for qualified borrowers. To give you personalized rates, I'll need to run a soft credit check. May I have your email and phone number?";
    }

    // Credit score questions
    if (lowerMessage.includes('credit') || lowerMessage.includes('score')) {
      return "We work with all credit types! Whether you have excellent, good, fair, or even poor credit, we can likely find you a loan option. Our soft credit check will show your current score and pre-approval terms. What's your email address to get started?";
    }

    // Application process
    if (lowerMessage.includes('apply') || lowerMessage.includes('application') || lowerMessage.includes('process')) {
      return "Our application process is quick and easy! I can pre-approve you right here in just a few minutes. Once pre-approved, you'll have access to our dealer network and can shop with confidence. Let's start with your email address and phone number.";
    }

    // Help/assistance
    if (lowerMessage.includes('help') || lowerMessage.includes('assist') || lowerMessage.includes('support')) {
      return "I'm here to help you get pre-approved for your car loan! I can answer questions about rates, terms, credit requirements, and guide you through the application. To provide personalized assistance, I'll need your email and phone number first.";
    }

    // Default response
    return "I'd be happy to help you with your car loan needs! To provide you with the most accurate information and get you pre-approved, I'll need your email address and phone number for a quick soft credit check. This won't affect your credit score. What's your email address?";
  }

  /**
   * Extract email from message
   */
  private extractEmail(message: string): string | null {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = message.match(emailRegex);
    return match ? match[0] : null;
  }

  /**
   * Extract phone number from message
   */
  private extractPhone(message: string): string | null {
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const match = message.match(phoneRegex);
    return match ? match[0] : null;
  }

  /**
   * Check for handoff conditions
   */
  private async checkForHandoff(sessionId: string, userMessage: string, response: string, visitorId?: number): Promise<void> {
    try {
      // Check if phone number was provided
      const phone = this.extractPhone(userMessage);
      
      if (phone) {
        const formattedPhone = formatPhoneE164(phone);
        
        // Emit handoff event to CreditCheckAgent
        this.emit('handoff_credit_check', {
          sessionId,
          phone: formattedPhone,
          visitorId
        });

        await storage.createAgentActivity({
          agentName: 'RealtimeChatAgent',
          action: 'handoff_credit_check',
          entityId: sessionId,
          entityType: 'chat_session',
          status: 'completed',
          metadata: { phone: formattedPhone }
        });

        console.log(`[RealtimeChatAgent] Handed off to CreditCheckAgent for session ${sessionId}`);
      }
    } catch (error) {
      console.error('[RealtimeChatAgent] Error checking for handoff:', error);
    }
  }

  /**
   * Handle return token (from email)
   */
  async handleReturnToken(token: string): Promise<{ sessionId: string; message: string }> {
    try {
      // Validate token with EmailReengagementAgent
      const { emailReengagementAgent } = await import('./email-reengagement');
      const tokenValidation = await emailReengagementAgent.validateReturnToken(token);
      
      if (!tokenValidation.valid) {
        throw new Error('Invalid or expired return token');
      }

      // Create new chat session
      const sessionId = generateSessionId();
      
      await storage.createChatSession({
        sessionId,
        visitorId: tokenValidation.visitorId || null,
        isActive: true
      });

      const welcomeMessage = "Welcome back! I see you're returning from our email. I'm ready to help you complete your car loan application. Let's pick up where you left off!";

      await storage.createChatMessage({
        sessionId,
        role: 'assistant',
        content: welcomeMessage
      });

      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'return_token_processed',
        entityId: sessionId,
        entityType: 'chat_session',
        status: 'completed',
        metadata: { returnToken: token, visitorId: tokenValidation.visitorId }
      });

      return { sessionId, message: welcomeMessage };
    } catch (error) {
      console.error('[RealtimeChatAgent] Error handling return token:', error);
      throw error;
    }
  }

  /**
   * End chat session
   */
  async endSession(sessionId: string): Promise<void> {
    try {
      await storage.updateChatSession(sessionId, { isActive: false });
      
      await storage.createAgentActivity({
        agentName: 'RealtimeChatAgent',
        action: 'session_ended',
        entityId: sessionId,
        entityType: 'chat_session',
        status: 'completed'
      });

      console.log(`[RealtimeChatAgent] Ended session ${sessionId}`);
    } catch (error) {
      console.error('[RealtimeChatAgent] Error ending session:', error);
    }
  }

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      const activeSessions = await storage.getActiveChatSessions();
      return activeSessions.length;
    } catch (error) {
      console.error('[RealtimeChatAgent] Error getting active sessions count:', error);
      return 0;
    }
  }
}

export const realtimeChatAgent = new RealtimeChatAgent();
