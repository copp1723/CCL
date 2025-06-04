import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Bot, 
  Settings, 
  Mail, 
  CreditCard, 
  Users, 
  MessageCircle,
  Package,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

interface AgentConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  status: 'active' | 'inactive' | 'error';
  settings: {
    enabled: boolean;
    maxConcurrent?: number;
    retryAttempts?: number;
    timeout?: number;
    customPrompt?: string;
  };
}

export default function AgentConfiguration() {
  const { toast } = useToast();

  const { data: agentStatuses } = useQuery({
    queryKey: ['/api/agents/status'],
    refetchInterval: 30000,
  });

  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>({
    VisitorIdentifierAgent: {
      name: "Visitor Identifier Agent",
      icon: Users,
      description: "Tracks and identifies website visitors, processes abandonment events",
      status: "active",
      settings: {
        enabled: true,
        maxConcurrent: 50,
        retryAttempts: 3,
        timeout: 30000,
        customPrompt: "You are Cathy, a friendly and experienced auto finance specialist at Complete Car Loans. Help identify and process visitor abandonment events with empathy and professionalism."
      }
    },
    RealtimeChatAgent: {
      name: "Realtime Chat Agent", 
      icon: MessageCircle,
      description: "Handles live customer conversations with Cathy's personality",
      status: "active",
      settings: {
        enabled: true,
        maxConcurrent: 10,
        retryAttempts: 2,
        timeout: 15000,
        customPrompt: "You are Cathy, a warm and knowledgeable finance expert. Engage customers naturally, understand their auto loan needs, and guide them toward completing their applications."
      }
    },
    EmailReengagementAgent: {
      name: "Email Reengagement Agent",
      icon: Mail,
      description: "Sends personalized Mailgun emails using Cathy's messaging",
      status: "active",
      settings: {
        enabled: true,
        maxConcurrent: 100,
        retryAttempts: 5,
        timeout: 60000,
        customPrompt: "You are Cathy writing personalized email outreach. Your tone is professional yet warm, with 15+ years of auto finance experience. Focus on helping customers overcome financing concerns."
      }
    },
    CreditCheckAgent: {
      name: "Credit Check Agent",
      icon: CreditCard,
      description: "Processes credit checks via FlexPath API integration",
      status: "active",
      settings: {
        enabled: true,
        maxConcurrent: 25,
        retryAttempts: 3,
        timeout: 45000,
        customPrompt: "You are Cathy guiding customers through credit checks. Be encouraging about credit rebuilding opportunities and explain the process clearly."
      }
    },
    LeadPackagingAgent: {
      name: "Lead Packaging Agent",
      icon: Package,
      description: "Packages qualified leads and submits to dealer CRM systems",
      status: "active",
      settings: {
        enabled: true,
        maxConcurrent: 30,
        retryAttempts: 4,
        timeout: 40000,
        customPrompt: "You are Cathy preparing lead packages for dealer partners. Ensure all customer information is complete and presented professionally."
      }
    }
  });

  const updateAgentConfig = (agentName: string, updates: Partial<AgentConfig['settings']>) => {
    setAgentConfigs(prev => ({
      ...prev,
      [agentName]: {
        ...prev[agentName],
        settings: {
          ...prev[agentName].settings,
          ...updates
        }
      }
    }));

    toast({
      title: "Agent Configuration Updated",
      description: `${agentName} settings have been saved`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 border-green-600';
      case 'inactive': return 'text-gray-600 border-gray-600';
      case 'error': return 'text-red-600 border-red-600';
      default: return 'text-gray-600 border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'inactive': return Clock;
      case 'error': return AlertCircle;
      default: return Clock;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Configuration</h1>
          <p className="text-muted-foreground">
            Configure AI agents, customize Cathy's personality, and manage system workflows
          </p>
        </div>
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Bot className="mr-1 h-3 w-3" />
          5 Agents Active
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(agentConfigs).map(([key, agent]) => {
          const status = agentStatuses?.find((s: any) => s.name === key)?.status || agent.status;
          const StatusIcon = getStatusIcon(status);
          const AgentIcon = agent.icon;
          
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <AgentIcon className="h-5 w-5 text-muted-foreground" />
                <StatusIcon className={`h-4 w-4 ${getStatusColor(status)}`} />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">{agent.name}</div>
                <Badge variant="outline" className={`text-xs mt-1 ${getStatusColor(status)}`}>
                  {status}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agent Settings</TabsTrigger>
          <TabsTrigger value="personality">Cathy's Personality</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {Object.entries(agentConfigs).map(([key, agent]) => {
                const AgentIcon = agent.icon;
                
                return (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <AgentIcon className="mr-2 h-5 w-5" />
                        {agent.name}
                      </CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={agent.settings.enabled}
                          onCheckedChange={(checked) => 
                            updateAgentConfig(key, { enabled: checked })
                          }
                        />
                        <Label>Enable Agent</Label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <Label htmlFor={`${key}-concurrent`}>Max Concurrent</Label>
                          <Input
                            id={`${key}-concurrent`}
                            type="number"
                            value={agent.settings.maxConcurrent || 10}
                            onChange={(e) => 
                              updateAgentConfig(key, { maxConcurrent: parseInt(e.target.value) })
                            }
                          />
                        </div>

                        <div>
                          <Label htmlFor={`${key}-retry`}>Retry Attempts</Label>
                          <Input
                            id={`${key}-retry`}
                            type="number"
                            value={agent.settings.retryAttempts || 3}
                            onChange={(e) => 
                              updateAgentConfig(key, { retryAttempts: parseInt(e.target.value) })
                            }
                          />
                        </div>

                        <div>
                          <Label htmlFor={`${key}-timeout`}>Timeout (ms)</Label>
                          <Input
                            id={`${key}-timeout`}
                            type="number"
                            value={agent.settings.timeout || 30000}
                            onChange={(e) => 
                              updateAgentConfig(key, { timeout: parseInt(e.target.value) })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`${key}-prompt`}>Custom Prompt</Label>
                        <Textarea
                          id={`${key}-prompt`}
                          className="min-h-20"
                          value={agent.settings.customPrompt || ""}
                          onChange={(e) => 
                            updateAgentConfig(key, { customPrompt: e.target.value })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="personality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cathy's Personality Configuration</CardTitle>
              <CardDescription>
                Customize how Cathy interacts with customers across all touchpoints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="cathy-bio">Professional Background</Label>
                <Textarea
                  id="cathy-bio"
                  value="I'm Cathy, your personal auto finance specialist with over 15 years of experience helping people secure affordable car loans. I specialize in working with customers who have credit challenges and pride myself on finding solutions where others might say no."
                  className="min-h-24"
                />
              </div>

              <div>
                <Label htmlFor="cathy-tone">Communication Tone</Label>
                <Textarea
                  id="cathy-tone"
                  value="Warm, professional, and empathetic. I use everyday language that's easy to understand, avoid financial jargon, and always focus on solutions rather than problems. I'm encouraging about credit rebuilding and honest about the process."
                  className="min-h-20"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="cathy-greeting">Standard Greeting</Label>
                  <Textarea
                    id="cathy-greeting"
                    value="Hi there! I'm Cathy from Complete Car Loans. I noticed you started your auto loan application, and I wanted to personally reach out to see how I can help you complete the process."
                    className="min-h-16"
                  />
                </div>

                <div>
                  <Label htmlFor="cathy-closing">Standard Closing</Label>
                  <Textarea
                    id="cathy-closing"
                    value="I'm here to help make your car financing as smooth as possible. Feel free to reach out with any questions - I'm on your side throughout this process."
                    className="min-h-16"
                  />
                </div>
              </div>

              <Button className="w-full">
                <Settings className="mr-2 h-4 w-4" />
                Save Personality Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Email Automation Workflow</CardTitle>
                <CardDescription>
                  Configure the abandonment recovery email sequence
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Step 1: Initial Outreach</span>
                    <Badge variant="outline">24 hours</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Step 2: Follow-up</span>
                    <Badge variant="outline">3 days</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Step 3: Final Attempt</span>
                    <Badge variant="outline">7 days</Badge>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Configure Timing
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credit Check Integration</CardTitle>
                <CardDescription>
                  FlexPath API configuration and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API Endpoint</span>
                    <Badge variant="outline">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Timeout</span>
                    <Badge variant="outline">45s</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retry Logic</span>
                    <Badge variant="outline">3 attempts</Badge>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}