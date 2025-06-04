import { Agent, tool } from '@openai/agents';
import { storage } from '../storage';
import type { ChatMessage } from '@shared/schema';

export class RealtimeChatAgent {
  private agent: Agent;

  constructor() {
    const handleChatMessageTool = tool({
      name: 'handle_chat_message',
      description: 'Process incoming chat messages and provide responses',
      execute: async ({ sessionId, message, returnToken }: {
        sessionId: string;
        message: string;
        returnToken?: string;
      }) => {
        return await this.processMessage(sessionId, message, returnToken);
      },
    });

    const createChatSessionTool = tool({
      name: 'create_chat_session',
      description: 'Create new chat session for visitor',
      execute: async ({ sessionId, returnToken }: {
        sessionId: string;
        returnToken?: string;
      }) => {
        return await this.createSession(sessionId, returnToken);
      },
    });

    const handoffToAgentTool = tool({
      name: 'handoff_to_agent',
      description: 'Handoff conversation to specialized agent for specific tasks',
      execute: async ({ sessionId, agentType, context }: {
        sessionId: string;
        agentType: string;
        context: any;
      }) => {
        return await this.handoffToAgent(sessionId, agentType, context);
      },
    });

    this.agent = new Agent({
      name: 'RealtimeChatAgent',
      instructions: `
        You are a helpful car loan assistant providing real-time chat support.
        
        Key responsibilities:
        1. Handle real-time chat via WebSocket with <1s latency target
        2. Help visitors complete their loan applications
        3. Collect phone numbers for credit checks when appropriate
        4. Handoff to CreditCheckAgent when visitor provides phone number
        5. Provide personalized assistance based on return token context
        6. Maintain conversation context throughout the session
        
        When a visitor provides a phone number, immediately handoff to the credit check agent.
        Be helpful, professional, and guide visitors toward completing their applications.
        Always maintain conversation history and context.
      `,
      tools: [handleChatMessageTool, createChatSessionTool, handoffToAgentTool],
    });
  }

  private async createSession(sessionId: string, returnToken?: string) {
    let visitorId: number | undefined;

    if (returnToken) {
      const token = await storage.getReturnToken(returnToken);
      if (token && !token.isUsed && token.expiresAt > new Date()) {
        visitorId = token.visitorId;
        await storage.updateReturnToken(returnToken, { isUsed: true });
        
        await storage.createActivity({
          type: 'return_token_used',
          description: `Visitor returned via email token`,
          agentId: (await storage.getAgentByType('realtime_chat'))?.id,
          relatedId: visitorId.toString(),
          metadata: { sessionId, returnToken }
        });
      }
    }

    const session = await storage.createChatSession({
      sessionId,
      visitorId,
      returnToken,
      isActive: true,
    });

    return session;
  }

  private async processMessage(sessionId: string, message: string, returnToken?: string) {
    let session = await storage.getChatSession(sessionId);
    
    if (!session) {
      session = await this.createSession(sessionId, returnToken);
    }

    // Store user message
    await storage.createChatMessage({
      sessionId,
      content: message,
      isAgent: false,
      agentType: null,
    });

    // Update session last message time
    await storage.updateChatSession(sessionId, {
      lastMessage: new Date(),
    });

    // Generate response based on message content
    let response = this.generateResponse(message, session);
    let shouldHandoff = false;
    let handoffType = '';

    // Check if message contains phone number
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    if (phoneRegex.test(message)) {
      shouldHandoff = true;
      handoffType = 'credit_check';
      response = "Thank you for providing your phone number! Let me run a quick credit check to see what loan options are available for you. This will only take a moment...";
    }

    // Store agent response
    await storage.createChatMessage({
      sessionId,
      content: response,
      isAgent: true,
      agentType: 'realtime_chat',
    });

    // Update agent metrics
    const agent = await storage.getAgentByType('realtime_chat');
    if (agent) {
      await storage.updateAgent(agent.id, {
        eventsProcessed: (agent.eventsProcessed || 0) + 1,
        lastActivity: new Date(),
      });
    }

    const result = {
      response,
      shouldHandoff,
      handoffType,
      sessionId,
    };

    if (shouldHandoff) {
      await this.handoffToAgent(sessionId, handoffType, { 
        phone: message.match(phoneRegex)?.[0],
        visitorId: session.visitorId 
      });
    }

    return result;
  }

  private generateResponse(message: string, session: any): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('application') || lowerMessage.includes('loan')) {
      return "I'd be happy to help you with your car loan application! Are you looking to apply for a new loan or continue a previous application?";
    }

    if (lowerMessage.includes('rate') || lowerMessage.includes('interest')) {
      return "We offer competitive rates starting at 3.99% APR for qualified borrowers. To get your personalized rate, I'll need to run a quick credit check. Can you provide your phone number?";
    }

    if (lowerMessage.includes('credit') || lowerMessage.includes('score')) {
      return "We work with all credit types! Our soft credit check won't impact your credit score. If you'd like to see what you qualify for, please provide your phone number and I'll get started.";
    }

    if (lowerMessage.includes('phone') || lowerMessage.includes('number')) {
      return "Please provide your phone number in the format (XXX) XXX-XXXX or XXX-XXX-XXXX so I can run your credit check.";
    }

    if (session.returnToken) {
      return "Welcome back! I see you're returning to complete your application. How can I help you continue where you left off?";
    }

    return "Hello! I'm here to help you with your car loan needs. Whether you're looking to apply for a new loan or have questions about our rates and terms, I'm here to assist. How can I help you today?";
  }

  private async handoffToAgent(sessionId: string, agentType: string, context: any) {
    await storage.createActivity({
      type: 'agent_handoff',
      description: `Chat session handed off to ${agentType} agent`,
      agentId: (await storage.getAgentByType('realtime_chat'))?.id,
      relatedId: sessionId,
      metadata: { targetAgent: agentType, context }
    });

    return { handoff: true, targetAgent: agentType, context };
  }

  async handleMessage(sessionId: string, message: string, returnToken?: string) {
    try {
      const result = await this.processMessage(sessionId, message, returnToken);
      
      await storage.createActivity({
        type: 'chat_message_processed',
        description: `Chat message processed for session ${sessionId}`,
        agentId: (await storage.getAgentByType('realtime_chat'))?.id,
        relatedId: sessionId,
        metadata: { messageLength: message.length, responseLength: result.response.length }
      });

      return result;
    } catch (error) {
      await storage.createActivity({
        type: 'chat_error',
        description: `Error processing chat message for session ${sessionId}`,
        agentId: (await storage.getAgentByType('realtime_chat'))?.id,
        relatedId: sessionId,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }

  getAgent() {
    return this.agent;
  }
}
