import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { agentOrchestrator } from '../agents';
import { storage } from '../storage';

interface WebSocketClient {
  ws: WebSocket;
  sessionId: string;
  isAlive: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('sessionId') || this.generateSessionId();
      const returnToken = url.searchParams.get('returnToken') || undefined;

      const client: WebSocketClient = {
        ws,
        sessionId,
        isAlive: true,
      };

      this.clients.set(sessionId, client);

      // Set up heartbeat
      ws.on('pong', () => {
        client.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(sessionId, message, returnToken);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendError(ws, 'Failed to process message');
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(sessionId);
        this.markSessionInactive(sessionId);
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: 'welcome',
        sessionId,
        message: 'Connected to CCL Assistant',
      });
    });
  }

  private async handleMessage(sessionId: string, message: any, returnToken?: string) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    const startTime = Date.now();

    try {
      if (message.type === 'chat') {
        // Process with RealtimeChatAgent
        const result = await agentOrchestrator.handleChatMessage(
          sessionId, 
          message.content, 
          returnToken
        );

        const responseTime = Date.now() - startTime;

        // Send response
        this.sendMessage(client.ws, {
          type: 'chat_response',
          content: result.response,
          sessionId,
          responseTime,
        });

        // Handle handoffs
        if (result.shouldHandoff && result.handoffType === 'credit_check') {
          // Extract phone from message and perform credit check
          const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
          const phoneMatch = message.content.match(phoneRegex);
          
          if (phoneMatch) {
            const phone = phoneMatch[0];
            const session = await storage.getChatSession(sessionId);
            
            if (session?.visitorId) {
              try {
                const creditResult = await agentOrchestrator.performCreditCheck(phone, session.visitorId);
                
                // Send credit check result
                this.sendMessage(client.ws, {
                  type: 'credit_result',
                  approved: creditResult.approved,
                  creditScore: creditResult.creditScore,
                  approvedAmount: creditResult.approvedAmount,
                  interestRate: creditResult.interestRate,
                  sessionId,
                });

                // Package and submit lead if approved
                if (creditResult.approved) {
                  await agentOrchestrator.packageAndSubmitLead(session.visitorId, true);
                  
                  this.sendMessage(client.ws, {
                    type: 'lead_submitted',
                    message: 'Congratulations! Your application has been submitted to our dealer network.',
                    sessionId,
                  });
                }
              } catch (error) {
                this.sendMessage(client.ws, {
                  type: 'error',
                  message: 'Unable to complete credit check at this time. Please try again.',
                  sessionId,
                });
              }
            }
          }
        }

        // Log performance metrics
        if (responseTime > 1000) {
          console.warn(`Slow response time: ${responseTime}ms for session ${sessionId}`);
        }

      } else if (message.type === 'ping') {
        this.sendMessage(client.ws, {
          type: 'pong',
          sessionId,
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      this.sendError(client.ws, 'Failed to process your message');
    }
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      error,
    });
  }

  private generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9);
  }

  private async markSessionInactive(sessionId: string) {
    await storage.updateChatSession(sessionId, { isActive: false });
  }

  private startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, sessionId) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(sessionId);
          this.markSessionInactive(sessionId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public broadcastMetrics(metrics: any) {
    const message = {
      type: 'metrics_update',
      metrics,
    };

    this.clients.forEach((client) => {
      this.sendMessage(client.ws, message);
    });
  }
}
