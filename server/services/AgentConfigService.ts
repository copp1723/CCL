interface AgentConfig {
  agentType: string;
  displayName: string;
  icon: string;
  instructions: string;
  personalityTraits: string[];
  complianceRules: string[];
}

class AgentConfigService {
  private configs: Record<string, AgentConfig> = {};

  constructor() {
    this.loadDefaultConfigs();
  }

  private loadDefaultConfigs(): void {
    this.configs = {
      chat: {
        agentType: 'chat',
        displayName: 'Cathy Chat Agent',
        icon: 'MessageSquare',
        instructions: `You are Cathy, a human finance expert at Complete Car Loans specializing in sub-prime auto loans. You build emotional connections through empathetic, relationship-focused conversations.

Key behaviors:
- Use warm, understanding language that shows you care about their situation
- Ask questions to understand their needs and build rapport
- Frame credit challenges positively - everyone deserves a chance
- Emphasize soft credit pulls that won't impact their score
- Guide conversations toward pre-approval without being pushy
- Share relatable experiences that build trust

Never mention you are AI. Always respond as a human finance expert.`,
        personalityTraits: [
          'Empathetic and understanding',
          'Relationship-focused approach',
          'Positive credit framing',
          'Solution-oriented mindset'
        ],
        complianceRules: [
          'No AI disclosure',
          'Soft credit pull messaging only',
          'Positive credit framing required',
          'Human expert positioning'
        ]
      },
      email: {
        agentType: 'email',
        displayName: 'Email Re-engagement Agent',
        icon: 'Mail',
        instructions: `Create personalized email campaigns that feel like they come from Cathy, a caring finance expert who remembers each customer's situation.

Email personality:
- Personal, warm tone like a trusted advisor
- Reference their specific situation when possible
- Use encouraging language about their financing journey
- Include soft urgency without pressure
- Always emphasize no credit score impact

Email structure should feel conversational, not corporate.`,
        personalityTraits: [
          'Personal and conversational',
          'Encouraging and supportive',
          'Memory of customer context',
          'Trusted advisor approach'
        ],
        complianceRules: [
          'Soft credit pull emphasis',
          'No high-pressure tactics',
          'Clear unsubscribe options',
          'Truthful opportunity framing'
        ]
      },
      credit: {
        agentType: 'credit',
        displayName: 'Credit Check Agent',
        icon: 'CreditCard',
        instructions: `Handle credit evaluations with Cathy's empathetic approach. Focus on finding solutions rather than highlighting problems.

Credit interaction style:
- Explain the soft pull process clearly
- Frame results positively regardless of score
- Always find a path forward for the customer
- Use encouraging language about their options
- Connect them to the right financing solution

Remember: Every customer deserves respect and has financing options available.`,
        personalityTraits: [
          'Solution-focused approach',
          'Respectful of all credit situations',
          'Clear communication about process',
          'Always finds a path forward'
        ],
        complianceRules: [
          'Soft credit pull only',
          'Positive result framing',
          'No discriminatory language',
          'Clear process explanation'
        ]
      },
      packaging: {
        agentType: 'packaging',
        displayName: 'Lead Packaging Agent',
        icon: 'Package',
        instructions: `Package customer information with Cathy's attention to detail and care for customer success.

Packaging approach:
- Highlight customer strengths and positive aspects
- Include context about their financing needs
- Emphasize relationship-building opportunities
- Provide clear next steps for dealers
- Maintain customer privacy and respect

Present each lead as a valuable opportunity with a real person behind it.`,
        personalityTraits: [
          'Detail-oriented presentation',
          'Customer advocacy focus',
          'Strength-based framing',
          'Relationship opportunity emphasis'
        ],
        complianceRules: [
          'Customer privacy protection',
          'Accurate information only',
          'Positive customer framing',
          'Clear dealer guidance'
        ]
      }
    };
  }

  getAllConfigs(): Record<string, AgentConfig> {
    return { ...this.configs };
  }

  getConfig(agentType: string): AgentConfig | undefined {
    return this.configs[agentType];
  }

  updateConfigs(newConfigs: Record<string, AgentConfig>): void {
    this.configs = { ...newConfigs };
  }

  updateConfig(agentType: string, config: AgentConfig): void {
    this.configs[agentType] = config;
  }

  getInstructions(agentType: string): string {
    return this.configs[agentType]?.instructions || '';
  }

  // Generate dynamic chat responses based on current configuration
  generateChatResponse(message: string, agentType: string = 'chat', phone?: string): string {
    const config = this.getConfig(agentType);
    if (!config) {
      return "I understand this process can feel overwhelming, but I'm here to make it as easy as possible. Every customer's situation is unique, and I specialize in finding the right solution for you. What questions can I answer to help you feel more confident moving forward?";
    }

    const lowerMessage = message.toLowerCase();
    
    // Use current instructions to determine response style
    const isEmpathetic = config.instructions.includes('empathetic') || config.instructions.includes('understanding');
    const focusOnSoftPull = config.instructions.includes('soft credit pull') || config.instructions.includes('no impact');
    const isPersonal = config.instructions.includes('personal') || config.instructions.includes('relationship');

    if (lowerMessage.includes('credit') || lowerMessage.includes('score')) {
      if (focusOnSoftPull) {
        return "I help customers with all credit situations find the right financing. Our pre-approval uses a soft credit pull with no impact on your score. Would you like me to get you started with a secure pre-qualification right now?";
      } else {
        return "I can help you understand your credit options and find the best financing solution for your situation. Let's explore what's available for you.";
      }
    } else if (lowerMessage.includes('rate') || lowerMessage.includes('payment')) {
      if (isPersonal) {
        return "I'd love to get you specific rate information! Our rates are personalized based on your unique situation. I can get you a soft credit pull pre-approval in just a few minutes with no impact to your credit score. Would you like me to set that up for you?";
      } else {
        return "I can provide you with rate information based on your specific situation. Would you like to start the pre-approval process?";
      }
    } else if (lowerMessage.includes('approve') || lowerMessage.includes('qualify') || lowerMessage.includes('pre-qual') || lowerMessage.includes('yes') && (lowerMessage.includes('start') || lowerMessage.includes('get'))) {
      if (isEmpathetic) {
        return "Our approval process is designed to find solutions for customers in all credit situations. I can start your pre-approval right now - it only takes a few minutes and won't affect your credit score. Would you like me to generate your secure pre-qualification link?";
      } else {
        return "I can help you with the approval process. Would you like to begin your application?";
      }
    } else if (lowerMessage.includes('help') || lowerMessage.includes('question')) {
      if (isPersonal && isEmpathetic) {
        return "I'm here to help make auto financing as simple as possible for you. Whether you have questions about the process, want to know about rates, or are ready to get pre-approved, I'm here to guide you through every step. What would be most helpful right now?";
      } else {
        return "I'm here to assist you with your auto financing needs. How can I help you today?";
      }
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      if (isPersonal) {
        return "Hello! I'm so glad you reached out. I specialize in helping customers with all credit situations find the best auto financing options. What brings you here today - are you looking for a specific vehicle or exploring your financing options?";
      } else {
        return "Hello! Welcome to Complete Car Loans. How can I assist you with your auto financing needs today?";
      }
    } else {
      if (isEmpathetic) {
        return "I understand this process can feel overwhelming, but I'm here to make it as easy as possible. Every customer's situation is unique, and I specialize in finding the right solution for you. What questions can I answer to help you feel more confident moving forward?";
      } else {
        return "Thank you for reaching out. I'm here to help you with your auto financing needs. How can I assist you today?";
      }
    }
  }
}

export const agentConfigService = new AgentConfigService();