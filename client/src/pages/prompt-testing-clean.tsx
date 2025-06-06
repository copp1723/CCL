import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Copy, Send, RotateCcw, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TestResponse {
  customerMessage: string;
  cathyResponse: string;
  analysis: string;
  salesReadiness: string;
  customerName: string;
  channel: string;
  insights: string;
  nextSteps?: string;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export default function PromptTesting() {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [customerName, setCustomerName] = useState('John Smith');
  const [customerSituation, setCustomerSituation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<TestResponse | null>(null);
  const { toast } = useToast();

  const scenarios = [
    {
      name: "Credit Anxiety",
      message: "I'm worried about my credit score. I've had some issues in the past and I'm not sure if I can get approved for a car loan.",
      situation: "Previous credit challenges, anxious about approval"
    },
    {
      name: "First Time Buyer", 
      message: "Hi, I'm looking to buy my first car and I'm not sure how auto financing works. Can you help me understand the process?",
      situation: "First-time buyer, needs education"
    },
    {
      name: "Ready to Apply",
      message: "I'm ready to get pre-approved for an auto loan. I found a car I like and want to move forward quickly.",
      situation: "High intent, ready to proceed"
    },
    {
      name: "Confused & Overwhelmed",
      message: "This is all so confusing. I've been to three dealerships and everyone is telling me different things. I don't know what to believe.",
      situation: "Overwhelmed by conflicting information"
    },
    {
      name: "Budget Focused",
      message: "I need to keep my monthly payment under $300. Is that possible with my credit situation?",
      situation: "Budget constraints, payment focused"
    },
    {
      name: "Abandoned Application",
      message: "I started an application last week but got confused with all the paperwork. Do I need to start over?",
      situation: "Previous abandonment, needs reassurance"
    }
  ];

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    setIsLoading(true);
    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setConversation(prev => [...prev, userMessage]);
    const messageToSend = currentMessage;
    setCurrentMessage('');

    try {
      // Mock response for now - replace with actual API call
      const mockResponse: TestResponse = {
        customerMessage: messageToSend,
        cathyResponse: generateMockCathyResponse(messageToSend),
        analysis: generateMockAnalysis(messageToSend),
        salesReadiness: determineSalesReadiness(messageToSend),
        customerName,
        channel: 'web_chat',
        insights: generateMockInsights(messageToSend),
        nextSteps: generateNextSteps(messageToSend)
      };

      setLastResponse(mockResponse);

      const agentMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: mockResponse.cathyResponse,
        timestamp: new Date(),
        metadata: mockResponse
      };

      setConversation(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to generate response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenario = (scenario: any) => {
    setCurrentMessage(scenario.message);
    setCustomerSituation(scenario.situation);
  };

  const clearConversation = () => {
    setConversation([]);
    setLastResponse(null);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard"
    });
  };

  // Mock functions - replace with actual API calls
  const generateMockCathyResponse = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('credit') && (lowerMsg.includes('worried') || lowerMsg.includes('issues'))) {
      return `Hi ${customerName}! I completely understand your concerns about credit - you're definitely not alone in feeling this way. I want you to know that I specialize in working with customers who have had credit challenges, and many of my most successful customers started exactly where you are.\n\nCredit history doesn't define your options; it just helps me find the right path forward for you. What kind of vehicle are you hoping to get? I'd love to show you what's possible.`;
    }
    
    if (lowerMsg.includes('first') || lowerMsg.includes('new') || lowerMsg.includes('understand')) {
      return `Welcome ${customerName}! I'm so glad you reached out - buying your first car is exciting! I'm here to make the financing process as simple and stress-free as possible for you.\n\nAuto financing is actually pretty straightforward: we'll do a quick, soft credit check (no impact to your score), see what you qualify for, and then help you find a vehicle that fits your budget and needs. Would you like me to walk you through each step?`;
    }
    
    if (lowerMsg.includes('ready') || lowerMsg.includes('apply') || lowerMsg.includes('pre-approved')) {
      return `That's wonderful, ${customerName}! I love working with customers who are ready to move forward. Getting pre-approved is smart - it gives you real purchasing power and lets you shop with confidence.\n\nI can get your pre-qualification started right now with just a soft credit check. This won't impact your credit score at all, and you'll know exactly what you qualify for in just a few minutes. Sound good?`;
    }
    
    return `Hi ${customerName}! I'm Cathy, and I'm really glad you stopped by today. I specialize in helping customers find the perfect auto financing solution, regardless of their credit situation. Every customer's needs are unique, and I'm here to make this process as easy as possible for you.\n\nWhat questions can I answer for you today?`;
  };

  const generateMockAnalysis = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('worried') || lowerMsg.includes('anxious')) {
      return 'Customer expressing anxiety about credit situation. Responding with empathy and reassurance to build trust and confidence.';
    }
    
    if (lowerMsg.includes('confused') || lowerMsg.includes('overwhelmed')) {
      return 'Customer feeling overwhelmed by information. Simplifying process and offering clear guidance.';
    }
    
    if (lowerMsg.includes('ready') || lowerMsg.includes('apply')) {
      return 'Customer showing high intent and readiness to proceed. Moving toward pre-qualification process.';
    }
    
    return 'Customer engaged in general inquiry. Building rapport and gathering needs information.';
  };

  const determineSalesReadiness = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('ready') || lowerMsg.includes('apply') || lowerMsg.includes('pre-approved')) {
      return 'high';
    }
    
    if (lowerMsg.includes('worried') || lowerMsg.includes('confused') || lowerMsg.includes('overwhelmed')) {
      return 'low';
    }
    
    return 'medium';
  };

  const generateMockInsights = (message: string): string => {
    return `Customer ${customerName} seeking information about auto financing. ${customerSituation || 'Standard inquiry with moderate engagement level.'}`;
  };

  const generateNextSteps = (message: string): string => {
    const readiness = determineSalesReadiness(message);
    
    if (readiness === 'high') {
      return 'Guide customer through soft credit check process and pre-qualification';
    }
    
    if (readiness === 'low') {
      return 'Build trust and confidence, address concerns, offer educational content';
    }
    
    return 'Continue building rapport and gather more information about customer needs';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Prompt Testing</h1>
          <p className="text-gray-600 dark:text-gray-400">Test AI responses with realistic customer scenarios</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Conversation */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Conversation
                </CardTitle>
                <p className="text-sm text-gray-600">Test the system prompt with realistic customer scenarios</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerSituation">Customer Situation</Label>
                    <Input
                      id="customerSituation"
                      value={customerSituation}
                      onChange={(e) => setCustomerSituation(e.target.value)}
                      placeholder="e.g., Previous credit challenges"
                    />
                  </div>
                </div>

                <Separator />

                <ScrollArea className="h-[400px] w-full border rounded-md p-4">
                  {conversation.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No messages yet. Start a conversation by sending a message.</p>
                    </div>
                  ) : (
                    conversation.map((message) => (
                      <div
                        key={message.id}
                        className={`mb-4 p-4 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-blue-50 dark:bg-blue-900/20 ml-8 border-l-4 border-blue-500'
                            : 'bg-green-50 dark:bg-green-900/20 mr-8 border-l-4 border-green-500'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm">
                            {message.type === 'user' ? customerName : 'Cathy'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyMessage(message.content)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <span className="text-xs text-gray-500 mt-2 block">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </ScrollArea>

                <div className="flex space-x-2">
                  <Textarea
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-1"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <div className="flex flex-col space-y-2">
                    <Button onClick={sendMessage} disabled={isLoading}>
                      <Send className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" onClick={clearConversation}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Scenarios */}
            <Card>
              <CardHeader>
                <CardTitle>Test Scenarios</CardTitle>
                <p className="text-sm text-gray-600">Pre-built scenarios to test different customer situations</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {scenarios.map((scenario, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => loadScenario(scenario)}
                    >
                      <h4 className="font-semibold text-sm">{scenario.name}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {scenario.message}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Response Analysis */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Response Analysis</CardTitle>
                <p className="text-sm text-gray-600">View detailed analysis of the AI response</p>
              </CardHeader>
              <CardContent>
                {!lastResponse ? (
                  <div className="text-center text-gray-500 py-12">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Send a message to see the AI response analysis</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Customer-Facing Response */}
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                        Cathy's Response:
                      </h4>
                      <p className="text-green-800 dark:text-green-200 leading-relaxed whitespace-pre-wrap">
                        {lastResponse.cathyResponse}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => copyMessage(lastResponse.cathyResponse)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Response
                      </Button>
                    </div>

                    {/* Analysis Grid */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer Name:</Label>
                        <p className="mt-1">{lastResponse.customerName}</p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer Message:</Label>
                        <p className="mt-1 text-sm">{lastResponse.customerMessage}</p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Analysis:</Label>
                        <p className="mt-1 text-sm">{lastResponse.analysis}</p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Channel:</Label>
                        <Badge variant="outline" className="mt-1">{lastResponse.channel}</Badge>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer Insights:</Label>
                        <p className="mt-1 text-sm">{lastResponse.insights}</p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Sales Readiness:</Label>
                        <Badge 
                          variant={
                            lastResponse.salesReadiness === 'high' ? 'default' :
                            lastResponse.salesReadiness === 'medium' ? 'secondary' : 'outline'
                          }
                          className="mt-1"
                        >
                          {lastResponse.salesReadiness}
                        </Badge>
                      </div>

                      {lastResponse.nextSteps && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                          <Label className="text-sm font-medium text-blue-600 dark:text-blue-400">Next Steps:</Label>
                          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">{lastResponse.nextSteps}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}