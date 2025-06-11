declare module "@openai/agents" {
  export class Agent {
    constructor(config: any);
    protected config: any;
    protected logger: any;
    log(message: string, data?: any): void;
    error(message: string, error?: any): void;
  }

  export interface AgentConfig {
    name: string;
    description?: string;
    [key: string]: any;
  }
}
