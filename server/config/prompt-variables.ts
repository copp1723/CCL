// Dynamic prompt configuration system for Cathy AI responses

export interface PromptVariables {
  // Tone and Style
  greeting_style: 'casual' | 'professional' | 'warm';
  enthusiasm_level: 'low' | 'medium' | 'high';
  formality: 'informal' | 'semi-formal' | 'formal';
  
  // Language Preferences
  avoid_words: string[];
  preferred_terms: Record<string, string>;
  
  // Response Structure
  max_response_length: 'short' | 'medium' | 'long';
  line_break_frequency: 'minimal' | 'moderate' | 'frequent';
  
  // Sales Approach
  urgency_level: 'low' | 'medium' | 'high';
  education_focus: boolean;
  trust_building_priority: 'low' | 'medium' | 'high';
  
  // Constraints
  never_mention: string[];
  always_include: string[];
  compliance_level: 'basic' | 'enhanced' | 'strict';
}

export const DEFAULT_PROMPT_VARIABLES: PromptVariables = {
  // Tone and Style
  greeting_style: 'warm',
  enthusiasm_level: 'medium',
  formality: 'informal',
  
  // Language Preferences
  avoid_words: ['folks', 'guys', 'subprime'],
  preferred_terms: {
    'customers': 'people',
    'credit_challenges': 'all credit situations',
    'application': 'pre-qualification'
  },
  
  // Response Structure
  max_response_length: 'short',
  line_break_frequency: 'moderate',
  
  // Sales Approach
  urgency_level: 'low',
  education_focus: true,
  trust_building_priority: 'high',
  
  // Constraints
  never_mention: ['rates', 'guarantees', 'approval promises'],
  always_include: ['soft credit check', 'no impact to score'],
  compliance_level: 'enhanced'
};

export class PromptVariableManager {
  private variables: PromptVariables;

  constructor(initialVariables: PromptVariables = DEFAULT_PROMPT_VARIABLES) {
    this.variables = { ...initialVariables };
  }

  // Update specific variables
  updateVariables(updates: Partial<PromptVariables>): void {
    this.variables = { ...this.variables, ...updates };
  }

  // Get current variables
  getVariables(): PromptVariables {
    return { ...this.variables };
  }

  // Apply variables to generate dynamic system prompt
  generateSystemPrompt(): string {
    const basePrompt = `You are "Cathy," a ${this.getPersonalityDescription()} auto finance specialist for Complete Car Loans.

${this.getToneInstructions()}

${this.getLanguageConstraints()}

${this.getResponseStructureGuidelines()}

${this.getSalesApproachGuidelines()}

${this.getComplianceConstraints()}`;

    return basePrompt;
  }

  // Apply variables to response generation
  applyToResponse(baseResponse: string, context: any): string {
    let response = baseResponse;

    // Apply language preferences
    this.variables.avoid_words.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      response = response.replace(regex, this.variables.preferred_terms[word] || 'customers');
    });

    // Apply greeting style
    response = this.applyGreetingStyle(response, context.customerName);

    // Apply response length constraints
    response = this.applyLengthConstraints(response);

    // Apply line break frequency
    response = this.applyLineBreaks(response);

    return response;
  }

  private getPersonalityDescription(): string {
    const styles = {
      casual: 'friendly and approachable',
      professional: 'experienced and knowledgeable',
      warm: 'caring and empathetic'
    };
    return styles[this.variables.greeting_style];
  }

  private getToneInstructions(): string {
    const enthusiasm = {
      low: 'Maintain a calm, steady tone.',
      medium: 'Use moderate enthusiasm and energy.',
      high: 'Be energetic and highly enthusiastic.'
    };

    const formality = {
      informal: 'Use casual, conversational language.',
      'semi-formal': 'Balance professional and friendly language.',
      formal: 'Use professional, polished language.'
    };

    return `${enthusiasm[this.variables.enthusiasm_level]} ${formality[this.variables.formality]}`;
  }

  private getLanguageConstraints(): string {
    let constraints = 'Language Guidelines:\n';
    
    if (this.variables.avoid_words.length > 0) {
      constraints += `- Never use: ${this.variables.avoid_words.join(', ')}\n`;
    }
    
    if (Object.keys(this.variables.preferred_terms).length > 0) {
      constraints += '- Preferred terms:\n';
      Object.entries(this.variables.preferred_terms).forEach(([key, value]) => {
        constraints += `  * Use "${value}" instead of "${key}"\n`;
      });
    }

    return constraints;
  }

  private getResponseStructureGuidelines(): string {
    const lengths = {
      short: 'Keep responses under 3 sentences per thought.',
      medium: 'Use 3-5 sentences per thought.',
      long: 'Use detailed explanations with 5+ sentences per thought.'
    };

    const lineBreaks = {
      minimal: 'Use line breaks sparingly.',
      moderate: 'Use line breaks between main thoughts.',
      frequent: 'Use frequent line breaks for easy reading.'
    };

    return `Response Structure:
- ${lengths[this.variables.max_response_length]}
- ${lineBreaks[this.variables.line_break_frequency]}`;
  }

  private getSalesApproachGuidelines(): string {
    const urgency = {
      low: 'No pressure tactics, focus on education.',
      medium: 'Gentle encouragement to move forward.',
      high: 'Create appropriate urgency to act.'
    };

    const trust = {
      low: 'Standard professional approach.',
      medium: 'Include trust-building elements.',
      high: 'Prioritize trust and rapport building.'
    };

    return `Sales Approach:
- ${urgency[this.variables.urgency_level]}
- ${trust[this.variables.trust_building_priority]}
- Education focus: ${this.variables.education_focus ? 'Prioritize teaching over selling' : 'Balance education with conversion'}`;
  }

  private getComplianceConstraints(): string {
    let constraints = 'Compliance Requirements:\n';
    
    if (this.variables.never_mention.length > 0) {
      constraints += `- Never mention: ${this.variables.never_mention.join(', ')}\n`;
    }
    
    if (this.variables.always_include.length > 0) {
      constraints += `- Always mention: ${this.variables.always_include.join(', ')}\n`;
    }

    const complianceLevels = {
      basic: 'Follow standard compliance guidelines.',
      enhanced: 'Apply enhanced compliance measures.',
      strict: 'Use strictest compliance protocols.'
    };

    constraints += `- ${complianceLevels[this.variables.compliance_level]}`;

    return constraints;
  }

  private applyGreetingStyle(response: string, customerName: string): string {
    const firstName = customerName.split(' ')[0];
    
    const greetings = {
      casual: `Hey ${firstName}!`,
      professional: `Hello ${firstName},`,
      warm: `Hi ${firstName}!`
    };

    // Replace generic greetings with styled ones
    const greetingPattern = /^(Hey|Hi|Hello)\s+\w+[!,]/;
    if (greetingPattern.test(response)) {
      response = response.replace(greetingPattern, greetings[this.variables.greeting_style]);
    }

    return response;
  }

  private applyLengthConstraints(response: string): string {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
    
    if (this.variables.max_response_length === 'short' && sentences.length > 6) {
      return sentences.slice(0, 6).join('. ') + '.';
    }
    
    return response;
  }

  private applyLineBreaks(response: string): string {
    if (this.variables.line_break_frequency === 'minimal') {
      return response.replace(/\n\n/g, ' ');
    }
    
    if (this.variables.line_break_frequency === 'frequent') {
      return response.replace(/\.\s/g, '.\n\n');
    }
    
    return response; // moderate - keep as is
  }
}

// Global instance
export const promptVariableManager = new PromptVariableManager();