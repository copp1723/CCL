import { useEffect, useRef, useState, useCallback } from 'react';
import { SocketManager, type ChatMessage } from '@/lib/socket';

interface UseWebSocketOptions {
  sessionId: string;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  isTyping: boolean;
  agentTyping: boolean;
}

export function useWebSocket({ sessionId, autoConnect = true }: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  
  const socketRef = useRef<SocketManager | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket manager
  useEffect(() => {
    socketRef.current = new SocketManager(sessionId);
    
    // Set up event listeners
    const socket = socketRef.current;
    
    socket.on('connection_status', (data: { connected: boolean }) => {
      setIsConnected(data.connected);
      setIsConnecting(false);
    });

    socket.on('connection_established', (data: any) => {
      console.log('Connection established:', data);
    });

    socket.on('agent_message', (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
      setAgentTyping(false);
    });

    socket.on('agent_typing', () => {
      setAgentTyping(true);
    });

    socket.on('handoff_initiated', (data: any) => {
      console.log('Handoff initiated:', data);
      // Could show a notification here
    });

    socket.on('error', (data: any) => {
      console.error('WebSocket error:', data);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  const connect = useCallback(async (): Promise<void> => {
    if (!socketRef.current) return;
    
    setIsConnecting(true);
    try {
      await socketRef.current.connect();
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback((): void => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && socketRef.current) {
      connect();
    }
  }, [autoConnect, connect]);

  const sendMessage = useCallback((content: string): void => {
    if (!socketRef.current || !isConnected) {
      console.warn('Cannot send message: not connected');
      return;
    }

    // Add user message to local state immediately
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      sessionId,
      sender: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Send to server
    socketRef.current.sendChatMessage(content);

    // Handle typing indicators
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socketRef.current.sendTypingStop();
  }, [isConnected, sessionId]);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!socketRef.current || !isConnected) return;

    if (!isTyping) {
      setIsTyping(true);
      socketRef.current.sendTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socketRef.current) {
        socketRef.current.sendTypingStop();
      }
    }, 2000);
  }, [isConnected, isTyping]);

  // Expose typing handler for input components
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    messages,
    sendMessage,
    connect,
    disconnect,
    isTyping,
    agentTyping,
  };
}
