import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Copy, Send, RotateCcw, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TestResponse {
  watermark: string;
  query_type: string;
  analysis: string;
  answer: string;
  sales_readiness?: string;
  required_fields?: any;
  insights?: string;
  approach?: string;
  email?: {
    salutation: string;
    subject: string;
    body: string;
    signoff: string;
  };
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  analysis?: any;
}

export default function PromptTesting() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [customerName, setCustomerName] = useState('John Smith');
  const [customerSituation, setCustomerSituation] = useState('');
  const [responseType, setResponseType] = useState<'chat' | 'email'>('chat');
  const [showJSON, setShowJSON] = useState(false);
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
      name: "Price Sensitive",
      message: "I need to keep my monthly payment under $300. Is that possible with my credit situation?",
      situation: "Budget constraints, payment focused"
    }
  ];

  useEffect(() => {
    loadSystemPrompt();
  }, []);

  const loadSystemPrompt = async () => {
    try {
      const response = await apiRequest('/api/agents/system-prompt');
      setSystemPrompt(response.prompt || '');
    } catch (error) {
      console.error('Failed to load system prompt:', error);
    }
  };

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
    setCurrentMessage('');

    try {
      const endpoint = responseType === 'chat' ? '/api/test/chat-response' : '/api/test/email-response';
      const response = await apiRequest(endpoint, {
        method: 'POST',
        data: {
          userMessage: currentMessage,
          customerName,
          customerSituation,
          conversationHistory: conversation.map(msg => ({
            type: msg.type,
            content: msg.content
          })),
          systemPrompt: systemPrompt
        }
      });

      setLastResponse(response);

      const agentMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: response.answer || response.email?.body || 'No response generated',
        timestamp: new Date(),
        analysis: response
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

  const updateSystemPrompt = async () => {
    try {
      await apiRequest('/api/agents/system-prompt', {
        method: 'POST',
        data: { prompt: systemPrompt }
      });
      
      toast({
        title: "Updated",
        description: "System prompt updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to update system prompt",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Prompt Testing</h1>
          <p className="text-gray-600 dark:text-gray-400">Test AI responses with realistic customer scenarios</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <div className="space-y-6">
            <Tabs defaultValue="system-prompt" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="system-prompt">System Prompt</TabsTrigger>
                <TabsTrigger value="conversation">Conversation Testing</TabsTrigger>
                <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="system-prompt" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      System Prompt Editor
                      <Button onClick={updateSystemPrompt} size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Update
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Enter system prompt..."
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="conversation" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Conversation</CardTitle>
                    <p className="text-sm text-gray-600">Test the system prompt with a conversation</p>
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
                        <Label htmlFor="responseType">Response Type</Label>
                        <select
                          className="w-full p-2 border rounded-md"
                          value={responseType}
                          onChange={(e) => setResponseType(e.target.value as 'chat' | 'email')}
                        >
                          <option value="chat">Chat Response</option>
                          <option value="email">Email Response</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="customerSituation">Customer Situation</Label>
                      <Input
                        id="customerSituation"
                        value={customerSituation}
                        onChange={(e) => setCustomerSituation(e.target.value)}
                        placeholder="e.g., Previous credit challenges, first-time buyer"
                      />
                    </div>

                    <Separator />

                    <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                      {conversation.length === 0 ? (
                        <p className="text-center text-gray-500">No messages yet. Start a conversation by sending a message.</p>
                      ) : (
                        conversation.map((message) => (
                          <div
                            key={message.id}
                            className={`mb-4 p-3 rounded-lg ${
                              message.type === 'user'
                                ? 'bg-blue-100 dark:bg-blue-900 ml-8'
                                : 'bg-gray-100 dark:bg-gray-800 mr-8'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-semibold">
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
                            <p className="text-sm">{message.content}</p>
                            {message.analysis && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <Badge variant="outline" className="mr-2">
                                  Sales Readiness: {message.analysis.sales_readiness || 'Unknown'}
                                </Badge>
                              </div>
                            )}
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
                        rows={2}
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
              </TabsContent>

              <TabsContent value="scenarios" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Test Scenarios</CardTitle>
                    <p className="text-sm text-gray-600">Pre-built scenarios to test different customer situations</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {scenarios.map((scenario, index) => (
                        <div
                          key={index}
                          className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          onClick={() => loadScenario(scenario)}
                        >
                          <h4 className="font-semibold text-sm">{scenario.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {scenario.message}
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {scenario.situation}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Testing Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-json">Show JSON Response</Label>
                      <Switch
                        id="show-json"
                        checked={showJSON}
                        onCheckedChange={setShowJSON}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Response */}
          <div>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Response</CardTitle>
                  <p className="text-sm text-gray-600">View the AI generated response</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="json-toggle">Show JSON</Label>
                  <Switch
                    id="json-toggle"
                    checked={showJSON}
                    onCheckedChange={setShowJSON}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {!lastResponse ? (
                  <div className="text-center text-gray-500 py-12">
                    <Send className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Send a message to see the AI response</p>
                  </div>
                ) : showJSON ? (
                  <ScrollArea className="h-[600px]">
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(lastResponse, null, 2)}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="space-y-6">
                    {/* Customer-Facing Message */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Customer-Facing Message:
                      </h4>
                      <p className="text-blue-800 dark:text-blue-200">
                        {lastResponse.answer || lastResponse.email?.body}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => copyMessage(lastResponse.answer || lastResponse.email?.body || '')}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Message
                      </Button>
                    </div>

                    {/* Response Analysis */}
                    <div>
                      <h4 className="font-semibold mb-3">Response Analysis:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-gray-600">Customer Name:</Label>
                          <p>{customerName}</p>
                        </div>
                        <div>
                          <Label className="text-gray-600">Query:</Label>
                          <p className="text-gray-800 dark:text-gray-200">
                            {currentMessage || 'No query'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-gray-600">Analysis:</Label>
                          <p className="text-gray-800 dark:text-gray-200">
                            {lastResponse.analysis}
                          </p>
                        </div>
                        <div>
                          <Label className="text-gray-600">Channel:</Label>
                          <p>{responseType}</p>
                        </div>
                        <div>
                          <Label className="text-gray-600">Insights:</Label>
                          <p className="text-gray-800 dark:text-gray-200">
                            {lastResponse.insights || 'Customer seeking information'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-gray-600">Sales Readiness:</Label>
                          <Badge variant={
                            lastResponse.sales_readiness === 'high' ? 'default' :
                            lastResponse.sales_readiness === 'medium' ? 'secondary' : 'outline'
                          }>
                            {lastResponse.sales_readiness || 'medium'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Email Specific Fields */}
                    {lastResponse.email && (
                      <div>
                        <h4 className="font-semibold mb-3">Email Details:</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <Label className="text-gray-600">Subject:</Label>
                            <p className="font-medium">{lastResponse.email.subject}</p>
                          </div>
                          <div>
                            <Label className="text-gray-600">Salutation:</Label>
                            <p>{lastResponse.email.salutation}</p>
                          </div>
                          <div>
                            <Label className="text-gray-600">Signoff:</Label>
                            <p>{lastResponse.email.signoff}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Required Fields */}
                    {lastResponse.required_fields && Object.keys(lastResponse.required_fields).length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Required Fields:</h4>
                        <div className="space-y-2">
                          {Object.entries(lastResponse.required_fields).map(([field, config]: [string, any]) => (
                            <div key={field} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="font-medium">{field.replace('_', ' ')}</span>
                              <Badge variant="outline">{config.type}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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