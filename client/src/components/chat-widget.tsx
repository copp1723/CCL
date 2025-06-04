import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/use-websocket';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, X, Send, Bot, User } from 'lucide-react';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { 
    isConnected, 
    isConnecting, 
    messages, 
    sendMessage, 
    agentTyping 
  } = useWebSocket({ 
    sessionId, 
    autoConnect: isOpen 
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (!message.trim() || !isConnected) return;
    
    sendMessage(message.trim());
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="h-16 w-16 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:scale-110 transition-all duration-300"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="w-96 h-[500px] shadow-2xl border border-gray-200 animate-fadeIn">
          {/* Chat Header */}
          <CardHeader className="bg-blue-600 text-white p-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold">CCL Assistant</h4>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-blue-100">We're here to help!</p>
                    {isConnected && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-100 text-xs">
                        Online
                      </Badge>
                    )}
                    {isConnecting && (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-100 text-xs">
                        Connecting...
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={toggleChat}
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Chat Messages */}
          <CardContent className="flex-1 p-4 h-80 overflow-y-auto chat-scrollbar">
            {!isConnected && !isConnecting && (
              <div className="text-center text-gray-500 text-sm mt-8">
                <p>Click to connect and start chatting</p>
              </div>
            )}

            {messages.length === 0 && isConnected && (
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                  <p className="text-sm text-gray-900">
                    Hi! I'm your CCL Assistant. I'm here to help you with your auto loan application. How can I assist you today?
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 mb-4 ${
                  msg.sender === 'user' ? 'justify-end' : ''
                }`}
              >
                {msg.sender === 'agent' && (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`rounded-lg p-3 max-w-xs ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.metadata?.latency && (
                    <p className="text-xs opacity-70 mt-1">
                      {msg.metadata.latency}ms
                    </p>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {/* Agent Typing Indicator */}
            {agentTyping && (
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isConnected}
                className="flex-1 text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || !isConnected}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {!isConnected && (
              <p className="text-xs text-gray-500 mt-2">
                {isConnecting ? 'Connecting...' : 'Not connected'}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
