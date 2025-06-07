
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
      };
      session: {
        userId?: string;
        [key: string]: any;
      };
      apiKey?: string;
      rateLimit?: {
        remaining: number;
        resetTime: Date;
      };
    }
  }
}

export {};
