import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage.js';

interface ChatWebSocket extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

export class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ChatWebSocket> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/chat'
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: ChatWebSocket, req) => {
      console.log('[WebSocket] New connection established');

      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      ws.sessionId = sessionId;
      ws.isAlive = true;
      this.clients.set(sessionId, ws);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'system',
        message: 'Connected to CCL Assistant',
        sessionId
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WebSocket] Error handling message:', error);
          this.sendMessage(ws, {
            type: 'error',
            message: 'Sorry, I encountered an error processing your message.'
          });
        }
      });

      // Handle connection close
      ws.on('close', () => {
        console.log(`[WebSocket] Connection closed for session: ${sessionId}`);
        this.clients.delete(sessionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for session ${sessionId}:`, error);
        this.clients.delete(sessionId);
      });

      // Heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });
  }

  private async handleMessage(ws: ChatWebSocket, message: any): Promise<void> {
    try {
      if (message.type === 'chat') {
        await this.handleChatMessage(ws, message.content, ws.sessionId!);
      }
    } catch (error) {
      console.error('[WebSocket] Error in handleMessage:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'Sorry, I encountered an error processing your message.'
      });
    }
  }

  private async handleChatMessage(ws: ChatWebSocket, content: string, sessionId: string): Promise<void> {
    try {
      // Cathy's empathetic responses under 50 words
      const cathyResponses = [
        "Hi! I'm Cathy from Complete Car Loans. How can I help with your auto financing today?",
        "I understand financing can be stressful. Let me see what options we have for you.",
        "We specialize in helping people with all credit situations. What's your main concern?",
        "Would you like me to check your pre-approval status? It only takes a minute.",
        "I'm here to make this process as smooth as possible. What questions do you have?",
        "Every situation is unique. Let's find the right solution for you.",
        "Bad credit? No problem! We work with many lenders who specialize in second chances.",
        "I can connect you with our loan specialist for a personalized quote."
      ];
      
      const response = cathyResponses[Math.floor(Math.random() * cathyResponses.length)];
      
      this.sendMessage(ws, {
        type: 'chat',
        message: response,
        metadata: { sessionId, timestamp: new Date().toISOString() }
      });

      // Log activity
      await storage.createActivity(
        'chat_message',
        `Chat interaction - User: "${content.substring(0, 30)}..." Response provided by Cathy`,
        'realtime-chat',
        { sessionId, messageLength: content.length, responseLength: response.length }
      );
    } catch (error) {
      console.error('[WebSocket] Chat processing error:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'I apologize, but I\'m having trouble responding right now. Please try again.'
      });
    }
  }

  private sendMessage(ws: ChatWebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(): void {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: ChatWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          if (ws.sessionId) {
            this.clients.delete(ws.sessionId);
          }
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  public broadcast(message: any): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  public sendToSession(sessionId: string, message: any): void {
    const client = this.clients.get(sessionId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public getConnectedSessions(): string[] {
    return Array.from(this.clients.keys());
  }
}