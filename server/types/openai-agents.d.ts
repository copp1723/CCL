declare module "@openai/agents" {
  export class Agent {
    constructor(config: any);
    protected config: any;
    protected logger: any;
    log(message: string, data?: any): void;
    error(message: string, error?: any): void;
    run?(params?: any): Promise<any>;
  }

  export interface AgentConfig {
    name: string;
    description?: string;
    tools?: any[];
    instructions?: string;
    [key: string]: any;
  }

  export function tool(config: {
    name: string;
    description: string;
    parameters?: any;
    execute?: (params: any) => Promise<any>;
  }): any;
}
