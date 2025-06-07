import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './database-storage.js';

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

      // Extract session ID from query params or generate new one
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('sessionId') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
            message: 'Failed to process message'
          });
        }
      });

      // Handle connection close
      ws.on('close', () => {
        console.log(`[WebSocket] Connection closed for session ${sessionId}`);
        this.clients.delete(sessionId);
        
        // End chat session
        if (sessionId) {
          realtimeChatAgent.endSession(sessionId).catch(error => {
            console.error('[WebSocket] Error ending session:', error);
          });
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for session ${sessionId}:`, error);
      });

      // Heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    console.log('[WebSocket] Server initialized on /ws/chat');
  }

  private async handleMessage(ws: ChatWebSocket, message: any): Promise<void> {
    const { type, content, sessionId: clientSessionId, returnToken } = message;
    const sessionId = ws.sessionId!;

    console.log(`[WebSocket] Received ${type} message for session ${sessionId}`);

    try {
      switch (type) {
        case 'chat':
          await this.handleChatMessage(ws, content, sessionId);
          break;
          
        case 'return_token':
          await this.handleReturnToken(ws, returnToken);
          break;
          
        case 'typing':
          // Handle typing indicators (could broadcast to other connected agents)
          break;
          
        default:
          console.warn(`[WebSocket] Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`[WebSocket] Error handling ${type} message:`, error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'Failed to process your message. Please try again.'
      });
    }
  }

  private async handleChatMessage(ws: ChatWebSocket, content: string, sessionId: string): Promise<void> {
    if (!content || content.trim().length === 0) {
      return;
    }

    // Show typing indicator
    this.sendMessage(ws, {
      type: 'typing',
      isTyping: true
    });

    try {
      // Process message with RealtimeChatAgent
      const response = await realtimeChatAgent.processMessage(sessionId, content);

      // Hide typing indicator and send response
      this.sendMessage(ws, {
        type: 'typing',
        isTyping: false
      });

      this.sendMessage(ws, {
        type: 'message',
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[WebSocket] Error processing chat message:', error);
      
      this.sendMessage(ws, {
        type: 'typing',
        isTyping: false
      });

      this.sendMessage(ws, {
        type: 'error',
        message: 'Sorry, I encountered an error. Please try again.'
      });
    }
  }

  private async handleReturnToken(ws: ChatWebSocket, returnToken: string): Promise<void> {
    try {
      const result = await realtimeChatAgent.handleReturnToken(returnToken);
      
      // Update WebSocket session ID
      if (ws.sessionId) {
        this.clients.delete(ws.sessionId);
      }
      
      ws.sessionId = result.sessionId;
      this.clients.set(result.sessionId, ws);

      this.sendMessage(ws, {
        type: 'return_token_validated',
        sessionId: result.sessionId,
        message: result.message
      });

    } catch (error) {
      console.error('[WebSocket] Error handling return token:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'Invalid or expired return token'
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
          console.log(`[WebSocket] Terminating dead connection for session ${ws.sessionId}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  public broadcast(message: any): void {
    this.clients.forEach((ws) => {
      this.sendMessage(ws, message);
    });
  }

  public sendToSession(sessionId: string, message: any): void {
    const ws = this.clients.get(sessionId);
    if (ws) {
      this.sendMessage(ws, message);
    }
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public getConnectedSessions(): string[] {
    return Array.from(this.clients.keys());
  }
}
