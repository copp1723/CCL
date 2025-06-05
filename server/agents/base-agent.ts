
import { Agent } from '@openai/agents';
import { storage } from '../storage';
import { createHash } from 'crypto';

export interface AgentConfig {
  name: string;
  instructions: string;
  tools: any[];
}

export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: any;
}

export abstract class BaseAgent {
  protected agent: Agent;
  protected agentName: string;

  constructor(config: AgentConfig) {
    this.agentName = config.name;
    this.agent = new Agent({
      name: config.name,
      instructions: config.instructions,
      tools: config.tools,
    });
  }

  protected async logActivity(
    action: string,
    description: string,
    targetId: string,
    metadata?: any
  ): Promise<void> {
    try {
      await storage.createActivity(
        action,
        description,
        this.agentName,
        { targetId, ...metadata }
      );
    } catch (error) {
      console.error(`[${this.agentName}] Failed to log activity:`, error);
    }
  }

  protected handleError(operation: string, error: any): AgentResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${this.agentName}] ${operation} failed:`, error);
    
    return {
      success: false,
      error: errorMessage,
      metadata: {
        operation,
        timestamp: new Date().toISOString(),
        agent: this.agentName,
      },
    };
  }

  protected createSuccessResult<T>(data: T, metadata?: any): AgentResult<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        agent: this.agentName,
        ...metadata,
      },
    };
  }

  protected hashEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email provided for hashing');
    }
    return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  }

  protected validateE164(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  protected formatToE164(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`;
  }

  getAgent(): Agent {
    return this.agent;
  }

  abstract getStatus(): Promise<{ active: boolean; processedToday: number; lastActivity: Date }>;
}
