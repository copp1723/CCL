import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, RotateCcw, MessageSquare, Mail, CreditCard, Package } from 'lucide-react';

interface AgentConfig {
  agentType: string;
  displayName: string;
  icon: string;
  instructions: string;
  personalityTraits: string[];
  complianceRules: string[];
}

interface AgentConfigEditorProps {
  className?: string;
}

export function AgentConfigEditor({ className }: AgentConfigEditorProps) {
  const [activeAgent, setActiveAgent] = useState('chat');
  const [configs, setConfigs] = useState<Record<string, AgentConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load current agent configurations
  const { data: agentConfigs, isLoading } = useQuery({
    queryKey: ['/api/agent-configs'],
    queryFn: async () => {
      const response = await fetch('/api/agent-configs');
      if (!response.ok) throw new Error('Failed to load configurations');
      return response.json();
    }
  });

  // Save configurations mutation
  const saveConfigsMutation = useMutation({
    mutationFn: async (newConfigs: Record<string, AgentConfig>) => {
      const response = await fetch('/api/agent-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfigs)
      });
      if (!response.ok) throw new Error('Failed to save configurations');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Agent instructions have been updated successfully.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/agent-configs'] });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Unable to save agent configurations. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (agentConfigs) {
      setConfigs(agentConfigs);
    }
  }, [agentConfigs]);

  const defaultConfigs: Record<string, AgentConfig> = {
    chat: {
      agentType: 'chat',
      displayName: 'Cathy Chat Agent',
      icon: 'MessageSquare',
      instructions: `You are Cathy, a human finance expert at Complete Car Loans specializing in sub-prime auto loans. You build emotional connections through empathetic, relationship-focused conversations.

Key behaviors:
- Use warm, understanding language that shows you care about their situation
- Ask questions to understand their needs and build rapport
- Frame credit challenges positively - everyone deserves a chance
- Emphasize soft credit pulls that won't impact their score
- Guide conversations toward pre-approval without being pushy
- Share relatable experiences that build trust

Never mention you are AI. Always respond as a human finance expert.`,
      personalityTraits: [
        'Empathetic and understanding',
        'Relationship-focused approach',
        'Positive credit framing',
        'Solution-oriented mindset'
      ],
      complianceRules: [
        'No AI disclosure',
        'Soft credit pull messaging only',
        'Positive credit framing required',
        'Human expert positioning'
      ]
    },
    email: {
      agentType: 'email',
      displayName: 'Email Re-engagement Agent',
      icon: 'Mail',
      instructions: `Create personalized email campaigns that feel like they come from Cathy, a caring finance expert who remembers each customer's situation.

Email personality:
- Personal, warm tone like a trusted advisor
- Reference their specific situation when possible
- Use encouraging language about their financing journey
- Include soft urgency without pressure
- Always emphasize no credit score impact

Email structure should feel conversational, not corporate.`,
      personalityTraits: [
        'Personal and conversational',
        'Encouraging and supportive',
        'Memory of customer context',
        'Trusted advisor approach'
      ],
      complianceRules: [
        'Soft credit pull emphasis',
        'No high-pressure tactics',
        'Clear unsubscribe options',
        'Truthful opportunity framing'
      ]
    },
    credit: {
      agentType: 'credit',
      displayName: 'Credit Check Agent',
      icon: 'CreditCard',
      instructions: `Handle credit evaluations with Cathy's empathetic approach. Focus on finding solutions rather than highlighting problems.

Credit interaction style:
- Explain the soft pull process clearly
- Frame results positively regardless of score
- Always find a path forward for the customer
- Use encouraging language about their options
- Connect them to the right financing solution

Remember: Every customer deserves respect and has financing options available.`,
      personalityTraits: [
        'Solution-focused approach',
        'Respectful of all credit situations',
        'Clear communication about process',
        'Always finds a path forward'
      ],
      complianceRules: [
        'Soft credit pull only',
        'Positive result framing',
        'No discriminatory language',
        'Clear process explanation'
      ]
    },
    packaging: {
      agentType: 'packaging',
      displayName: 'Lead Packaging Agent',
      icon: 'Package',
      instructions: `Package customer information with Cathy's attention to detail and care for customer success.

Packaging approach:
- Highlight customer strengths and positive aspects
- Include context about their financing needs
- Emphasize relationship-building opportunities
- Provide clear next steps for dealers
- Maintain customer privacy and respect

Present each lead as a valuable opportunity with a real person behind it.`,
      personalityTraits: [
        'Detail-oriented presentation',
        'Customer advocacy focus',
        'Strength-based framing',
        'Relationship opportunity emphasis'
      ],
      complianceRules: [
        'Customer privacy protection',
        'Accurate information only',
        'Positive customer framing',
        'Clear dealer guidance'
      ]
    }
  };

  const handleConfigChange = (agentType: string, field: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [agentType]: {
        ...prev[agentType],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setConfigs(defaultConfigs);
    setHasChanges(true);
    toast({
      title: "Reset to Defaults",
      description: "All agent configurations have been reset to default values.",
    });
  };

  const saveConfigurations = () => {
    saveConfigsMutation.mutate(configs);
  };

  const currentConfig = configs[activeAgent] || defaultConfigs[activeAgent];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'MessageSquare': return <MessageSquare className="h-4 w-4" />;
      case 'Mail': return <Mail className="h-4 w-4" />;
      case 'CreditCard': return <CreditCard className="h-4 w-4" />;
      case 'Package': return <Package className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Loading Agent Configuration...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent Configuration Editor
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={saveConfigsMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Defaults
            </Button>
            <Button
              onClick={saveConfigurations}
              disabled={!hasChanges || saveConfigsMutation.isPending}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveConfigsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Tabs value={activeAgent} onValueChange={setActiveAgent}>
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(defaultConfigs).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                {getIcon(config.icon)}
                <span className="hidden sm:inline">{config.displayName.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(defaultConfigs).map(([key, defaultConfig]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor={`instructions-${key}`} className="text-base font-medium">
                    Agent Instructions
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Define how {currentConfig?.displayName || defaultConfig.displayName} should behave and respond
                  </p>
                  <Textarea
                    id={`instructions-${key}`}
                    value={currentConfig?.instructions || ''}
                    onChange={(e) => handleConfigChange(key, 'instructions', e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="Enter detailed instructions for the agent..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Personality Traits</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(currentConfig?.personalityTraits || defaultConfig.personalityTraits).map((trait, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Compliance Rules</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(currentConfig?.complianceRules || defaultConfig.complianceRules).map((rule, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {rule}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {hasChanges && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      You have unsaved changes. Click "Save Changes" to apply your modifications to the live system.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}