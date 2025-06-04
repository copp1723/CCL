/**
 * Cathy Personality Service
 * Centralizes the Complete Car Loans finance expert personality across all agents
 */

import { 
  CORE_PERSONALITY, 
  CONVERSATION_FLOWS,
  SPECIAL_SCENARIOS,
  CREDIT_PROFILE_HANDLING,
  formatResponseByTone,
  getCreditProfileApproach,
  type ConversationContext,
  type AgentResponse
} from '../agents/core-personality';

export class CathyPersonalityService {
  
  /**
   * Generate Cathy's personalized introduction based on context
   */
  generateIntroduction(dealershipName: string = "Complete Car Loans", customerName?: string): string {
    const greeting = customerName ? `Hi ${customerName}, ` : "Hi there, ";
    return `${greeting}I'm Cathy, your finance expert at ${dealershipName}. I specialize in helping customers like you find the best financing options, no matter your credit history.`;
  }

  /**
   * Generate email content using Cathy's personality
   */
  generateEmailContent(context: {
    customerName?: string;
    abandonmentStep: number;
    timeSinceLastContact?: number;
    creditScore?: number;
  }): { subject: string; body: string } {
    
    const { customerName, abandonmentStep, timeSinceLastContact = 0, creditScore } = context;
    
    // Personalized subject lines
    const subjects = [
      customerName ? `${customerName}, quick question about your auto financing` : "Quick question about your auto financing",
      "Let's continue where we left off",
      "Your financing options are ready to review",
      "One more step to complete your application"
    ];

    // Cathy's empathetic email templates
    const emailTemplates = [
      {
        greeting: customerName ? `Hi ${customerName}, it's Cathy from Complete Car Loans.` : "Hi there, it's Cathy from Complete Car Loans.",
        body: `I noticed you were looking into auto financing options, and I wanted to reach out personally to see if you had any questions about the process.

I specialize in helping customers with all credit situations find the best financing options. Our pre-approval uses a soft credit pull, so there's no impact on your credit score.

Would you like me to walk you through the next steps? I'm here to make this as easy as possible for you.`,
        closing: "Best regards,\nCathy\nComplete Car Loans"
      },
      {
        greeting: customerName ? `Hi ${customerName}, it's Cathy from Complete Car Loans.` : "Hi again, it's Cathy from Complete Car Loans.",
        body: `It's been a little while since we last spoke, and I wanted to check in to see how you're doing with your auto financing search.

You started your application with us, and I wanted to make sure you have everything you need to move forward. Many of our customers find the process straightforward once they get the right guidance.

Is there anything specific I can help clarify? I'm here to support you through every step.`,
        closing: "Best regards,\nCathy\nComplete Car Loans"
      },
      {
        greeting: customerName ? `Hi ${customerName}, it's Cathy again from Complete Car Loans.` : "Hi, it's Cathy again from Complete Car Loans.",
        body: `Great news! I have your financing options ready to review. You're one step closer to getting behind the wheel of your next vehicle.

Our team has put together some options that work well for customers in similar situations. The next step is just a quick conversation to walk through your personalized options.

When would be a good time to connect? I'm excited to help you move forward.`,
        closing: "Best regards,\nCathy\nComplete Car Loans"
      }
    ];

    const templateIndex = Math.min(abandonmentStep - 1, emailTemplates.length - 1);
    const subjectIndex = Math.min(abandonmentStep - 1, subjects.length - 1);
    const template = emailTemplates[templateIndex];

    // Add credit-specific messaging if available
    let creditApproach = "";
    if (creditScore) {
      const approach = getCreditProfileApproach(creditScore);
      if (creditScore >= 8) {
        creditApproach = "\n\nBased on your profile, you may qualify for our best rates and terms.";
      } else if (creditScore >= 5) {
        creditApproach = "\n\nWe have flexible options that work well for customers in your situation.";
      } else {
        creditApproach = "\n\nDon't worry about credit challenges - we specialize in finding solutions that work.";
      }
    }

    const fullBody = `${template.greeting}

${template.body}${creditApproach}

${template.closing}`;

    return {
      subject: subjects[subjectIndex],
      body: fullBody
    };
  }

  /**
   * Generate chat responses using Cathy's personality
   */
  generateChatResponse(context: {
    userMessage: string;
    customerName?: string;
    conversationHistory?: string;
    creditScore?: number;
    isFirstInteraction?: boolean;
  }): string {
    
    const { userMessage, customerName, isFirstInteraction = false, creditScore } = context;
    
    // First interaction introduction
    if (isFirstInteraction) {
      return this.generateIntroduction("Complete Car Loans", customerName) + 
        "\n\nHow can I help you with your auto financing today?";
    }

    // Analyze user intent and respond appropriately
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('credit') || lowerMessage.includes('score')) {
      return this.generateCreditResponse(creditScore, customerName);
    }
    
    if (lowerMessage.includes('rate') || lowerMessage.includes('payment')) {
      return this.generateRateInquiryResponse(customerName);
    }
    
    if (lowerMessage.includes('approve') || lowerMessage.includes('qualify')) {
      return this.generateApprovalResponse(creditScore, customerName);
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('question')) {
      return this.generateHelpResponse(customerName);
    }

    // Default supportive response
    return this.generateSupportiveResponse(customerName);
  }

  /**
   * Generate credit check status messages
   */
  generateCreditCheckMessage(
    status: 'initiated' | 'success' | 'failed',
    customerName?: string,
    creditScore?: number
  ): string {
    
    const baseMessages = SPECIAL_SCENARIOS.creditCheckStatus;
    let message = baseMessages[status];
    
    if (status === 'success' && creditScore) {
      if (creditScore >= 8) {
        message += " You may qualify for our best rates and terms.";
      } else if (creditScore >= 5) {
        message += " We have several flexible options that should work well for you.";
      } else {
        message += " We have specialized programs designed for your situation.";
      }
    }
    
    const greeting = customerName ? `Hi ${customerName}, ` : "";
    const signature = "\n\nBest regards,\nCathy\nComplete Car Loans";
    
    return `${greeting}${message}${signature}`;
  }

  /**
   * Private helper methods for specific response types
   */
  private generateCreditResponse(creditScore?: number, customerName?: string): string {
    const greeting = customerName ? `${customerName}, ` : "";
    
    if (creditScore) {
      if (creditScore >= 8) {
        return `${greeting}great news about your credit! Your strong credit profile opens up our best financing options. Our pre-approval uses a soft credit pull, so there's no impact on your credit score. Would you like me to get your personalized rates?`;
      } else if (creditScore >= 5) {
        return `${greeting}I work with customers in all credit situations, and we have flexible options that work well for profiles like yours. Our pre-approval won't affect your credit score. Shall we take a look at what's available?`;
      } else {
        return `${greeting}I understand credit challenges can be stressful, but that's exactly what I specialize in. We have programs designed specifically for rebuilding credit through auto financing. Would you like to explore your options?`;
      }
    }
    
    return `${greeting}I help customers with all credit situations find the right financing. Our pre-approval uses a soft credit pull with no impact on your score. Would you like to see what options are available for you?`;
  }

  private generateRateInquiryResponse(customerName?: string): string {
    const greeting = customerName ? `${customerName}, ` : "";
    return `${greeting}I'd love to get you specific rate information! Our rates are personalized based on your unique situation. I can get you a soft credit pull pre-approval in just a few minutes with no impact to your credit score. Would you like me to get started on that?`;
  }

  private generateApprovalResponse(creditScore?: number, customerName?: string): string {
    const greeting = customerName ? `${customerName}, ` : "";
    return `${greeting}our approval process is designed to find solutions for customers in all credit situations. I can start your pre-approval right now - it only takes a few minutes and won't affect your credit score. Shall we get started?`;
  }

  private generateHelpResponse(customerName?: string): string {
    const greeting = customerName ? `${customerName}, ` : "";
    return `${greeting}I'm here to help make auto financing as simple as possible for you. Whether you have questions about the process, want to know about rates, or are ready to get pre-approved, I'm here to guide you through every step. What would be most helpful right now?`;
  }

  private generateSupportiveResponse(customerName?: string): string {
    const greeting = customerName ? `${customerName}, ` : "";
    return `${greeting}I understand this process can feel overwhelming, but I'm here to make it as easy as possible. Every customer's situation is unique, and I specialize in finding the right solution for you. What questions can I answer to help you feel more confident moving forward?`;
  }

  /**
   * Format response according to Cathy's tone guidelines
   */
  formatResponse(
    type: 'positive' | 'negative' | 'progress',
    content: string,
    customerName?: string
  ): string {
    const greeting = customerName ? `Hi ${customerName}, ` : "";
    
    switch (type) {
      case 'positive':
        return `${greeting}Yes, ${content}`;
      case 'negative':
        return `${greeting}I understand this situation, and ${content}`;
      case 'progress':
        return `${greeting}You're making great progress! ${content}`;
      default:
        return `${greeting}${content}`;
    }
  }

  /**
   * Validate response against Cathy's constraints
   */
  validateResponse(response: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const lowerResponse = response.toLowerCase();
    
    // Check for prohibited content
    if (lowerResponse.includes('ai') || lowerResponse.includes('bot') || lowerResponse.includes('automation')) {
      issues.push('Contains AI/automation disclosure');
    }
    
    if (lowerResponse.includes('subprime') || lowerResponse.includes('bad credit')) {
      issues.push('Uses negative credit labeling');
    }
    
    if (lowerResponse.includes('guarantee') && lowerResponse.includes('approve')) {
      issues.push('Contains approval guarantee');
    }
    
    if (lowerResponse.includes('act now') || lowerResponse.includes('limited time')) {
      issues.push('Contains high-pressure sales language');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

export const cathyPersonalityService = new CathyPersonalityService();