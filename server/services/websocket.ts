import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse as parseUrl } from 'url';
import { storage } from '../storage';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: Date;
}

export interface ChatClient {
  ws: WebSocket;
  sessionId: string;
  visitorId?: number;
  lastPing: Date;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients = new Map<string, ChatClient>();
  private pingInterval: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    try {
      const url = parseUrl(request.url, true);
      const sessionId = url.query.sessionId as string;

      if (!sessionId) {
        ws.close(1008, 'Session ID required');
        return;
      }

      // Check if visitor exists for this session
      const visitor = await storage.getVisitorBySessionId(sessionId);

      const client: ChatClient = {
        ws,
        sessionId,
        visitorId: visitor?.id,
        lastPing: new Date(),
      };

      this.clients.set(sessionId, client);

      console.log(`WebSocket connected: ${sessionId} (visitor: ${visitor?.id || 'new'})`);

      // Send connection confirmation
      this.sendToClient(client, {
        type: 'connection_established',
        data: {
          sessionId,
          visitorId: visitor?.id,
          timestamp: new Date(),
        },
      });

      // Initialize chat session
      const { realtimeChatService } = await import('../agents/realtime-chat');
      await realtimeChatService.handleNewChatSession(sessionId, visitor?.id);

      // Setup message handlers
      ws.on('message', (data) => this.handleMessage(client, data));
      ws.on('close', () => this.handleDisconnection(client));
      ws.on('error', (error) => this.handleError(client, error));
      ws.on('pong', () => {
        client.lastPing = new Date();
      });

    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async handleMessage(client: ChatClient, data: Buffer): Promise<void> {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      
      switch (message.type) {
        case 'chat_message':
          await this.handleChatMessage(client, message.data);
          break;
        
        case 'typing_start':
          this.broadcastToSession(client.sessionId, {
            type: 'user_typing',
            data: { sessionId: client.sessionId },
          }, client.sessionId);
          break;
        
        case 'typing_stop':
          this.broadcastToSession(client.sessionId, {
            type: 'user_stopped_typing',
            data: { sessionId: client.sessionId },
          }, client.sessionId);
          break;
        
        case 'ping':
          client.lastPing = new Date();
          this.sendToClient(client, { type: 'pong', data: {} });
          break;
        
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToClient(client, {
        type: 'error',
        data: { message: 'Invalid message format' },
      });
    }
  }

  private async handleChatMessage(client: ChatClient, data: any): Promise<void> {
    try {
      if (!data.content || typeof data.content !== 'string') {
        throw new Error('Invalid message content');
      }

      // Rate limiting - simple implementation
      if (!this.checkRateLimit(client.sessionId)) {
        this.sendToClient(client, {
          type: 'rate_limit_exceeded',
          data: { message: 'Too many messages. Please wait.' },
        });
        return;
      }

      // Send typing indicator
      this.sendToClient(client, {
        type: 'agent_typing',
        data: { sessionId: client.sessionId },
      });

      // Process message with chat agent
      const { realtimeChatService } = await import('../agents/realtime-chat');
      await realtimeChatService.handleUserMessage(client.sessionId, data.content);

    } catch (error) {
      console.error('Error handling chat message:', error);
      this.sendToClient(client, {
        type: 'error',
        data: { message: 'Failed to process message' },
      });
    }
  }

  private async handleDisconnection(client: ChatClient): Promise<void> {
    try {
      console.log(`WebSocket disconnected: ${client.sessionId}`);
      
      this.clients.delete(client.sessionId);

      // End chat session
      const { realtimeChatService } = await import('../agents/realtime-chat');
      await realtimeChatService.endChatSession(client.sessionId);

    } catch (error) {
      console.error('Error handling WebSocket disconnection:', error);
    }
  }

  private handleError(client: ChatClient, error: Error): void {
    console.error(`WebSocket error for ${client.sessionId}:`, error);
  }

  public sendToSession(sessionId: string, message: WebSocketMessage): void {
    const client = this.clients.get(sessionId);
    if (client) {
      this.sendToClient(client, message);
    }
  }

  public sendToClient(client: ChatClient, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: message.timestamp || new Date(),
        };
        client.ws.send(JSON.stringify(messageWithTimestamp));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  public broadcastToSession(sessionId: string, message: WebSocketMessage, excludeSessionId?: string): void {
    this.clients.forEach((client, id) => {
      if (id !== excludeSessionId && client.sessionId === sessionId) {
        this.sendToClient(client, message);
      }
    });
  }

  public broadcast(message: WebSocketMessage): void {
    this.clients.forEach((client) => {
      this.sendToClient(client, message);
    });
  }

  // Simple rate limiting - 10 messages per minute per session
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimitMap.get(sessionId);

    if (!limit || now > limit.resetTime) {
      this.rateLimitMap.set(sessionId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (limit.count >= 10) {
      return false;
    }

    limit.count++;
    return true;
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const timeout = 30000; // 30 seconds

      this.clients.forEach((client, sessionId) => {
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          console.log(`Removing stale WebSocket connection: ${sessionId}`);
          client.ws.terminate();
          this.clients.delete(sessionId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 15000); // Check every 15 seconds
  }

  public getConnectedSessions(): string[] {
    return Array.from(this.clients.keys());
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close(1001, 'Server shutting down');
    });

    this.wss.close();
  }
}
