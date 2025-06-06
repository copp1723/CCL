import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Eye, Send, Plus, Edit, Trash2, Play } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
  category: 'welcome' | 'followup' | 'reminder' | 'approval' | 'custom';
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  templates: EmailTemplate[];
  triggerConditions: {
    leadStatus?: string[];
    daysSinceLastContact?: number;
    vehicleInterest?: string[];
    creditScore?: string;
  };
}

export default function EmailCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    html: '',
    text: '',
    category: 'custom' as const,
    variables: [] as string[]
  });
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [testEmail, setTestEmail] = useState('');

  // Fetch templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/email-campaigns/templates'],
  });

  // Fetch campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['/api/email-campaigns/campaigns'],
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (templateData: any) => apiRequest('/api/email-campaigns/templates', {
      method: 'POST',
      data: templateData,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns/templates'] });
      setNewTemplate({
        name: '',
        subject: '',
        html: '',
        text: '',
        category: 'custom',
        variables: []
      });
      toast({
        title: "Template Created",
        description: "Email template created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: ({ templateId, testEmail, variables }: any) => 
      apiRequest(`/api/email-campaigns/templates/${templateId}/test-send`, {
        method: 'POST',
        data: { testEmail, variables },
      }),
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Test email sent successfully",
      });
      setTestEmail('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  const templates: EmailTemplate[] = (templatesData as any)?.data || [];
  const campaigns: Campaign[] = (campaignsData as any)?.data || [];

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.html) {
      toast({
        title: "Error",
        description: "Name, subject, and HTML content are required",
        variant: "destructive",
      });
      return;
    }

    createTemplateMutation.mutate(newTemplate);
  };

  const handleTestEmail = (template: EmailTemplate) => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Test email address is required",
        variant: "destructive",
      });
      return;
    }

    testEmailMutation.mutate({
      templateId: template.id,
      testEmail,
      variables: previewVariables
    });
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      welcome: 'bg-blue-100 text-blue-800',
      followup: 'bg-yellow-100 text-yellow-800',
      reminder: 'bg-red-100 text-red-800',
      approval: 'bg-green-100 text-green-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.custom;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">
            Manage email templates and automated campaigns
          </p>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="create">Create Template</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {templatesLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p>Loading templates...</p>
                </CardContent>
              </Card>
            ) : (
              templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Mail className="h-5 w-5" />
                          {template.name}
                          <Badge className={getCategoryColor(template.category)}>
                            {template.category}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{template.subject}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {template.variables.length > 0 && (
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-sm text-muted-foreground">Variables:</span>
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-4">
            {campaignsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p>Loading campaigns...</p>
                </CardContent>
              </Card>
            ) : (
              campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      {campaign.name}
                    </CardTitle>
                    <CardDescription>{campaign.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Templates ({campaign.templates.length}):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {campaign.templates.map((template, index) => (
                            <Badge key={template.id} variant="outline">
                              {index + 1}. {template.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {campaign.triggerConditions && (
                        <div>
                          <span className="text-sm font-medium">Trigger Conditions:</span>
                          <div className="text-sm text-muted-foreground mt-1">
                            {campaign.triggerConditions.leadStatus && (
                              <p>Lead Status: {campaign.triggerConditions.leadStatus.join(', ')}</p>
                            )}
                            {campaign.triggerConditions.vehicleInterest && (
                              <p>Vehicle Interest: {campaign.triggerConditions.vehicleInterest.join(', ')}</p>
                            )}
                            {campaign.triggerConditions.daysSinceLastContact && (
                              <p>Days Since Contact: {campaign.triggerConditions.daysSinceLastContact}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Email Template</CardTitle>
              <CardDescription>
                Create a new email template for your campaigns. Use variables like firstName in double braces for personalization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Welcome Email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    value={newTemplate.category}
                    onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="approval">Approval</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-subject">Email Subject</Label>
                <Input
                  id="template-subject"
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                  placeholder="{{firstName}}, your auto loan application update"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-html">HTML Content</Label>
                <Textarea
                  id="template-html"
                  value={newTemplate.html}
                  onChange={(e) => setNewTemplate({ ...newTemplate, html: e.target.value })}
                  placeholder="Enter HTML email content..."
                  className="min-h-[200px] font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-text">Plain Text Content (Optional)</Label>
                <Textarea
                  id="template-text"
                  value={newTemplate.text}
                  onChange={(e) => setNewTemplate({ ...newTemplate, text: e.target.value })}
                  placeholder="Enter plain text version..."
                  className="min-h-[100px]"
                />
              </div>

              <Button 
                onClick={handleCreateTemplate}
                disabled={createTemplateMutation.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedTemplate.name}</CardTitle>
                <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Subject: {selectedTemplate.subject}</Label>
              </div>
              
              {selectedTemplate.variables.length > 0 && (
                <div className="space-y-2">
                  <Label>Test Variables:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable}>
                        <Label htmlFor={`var-${variable}`}>{variable}</Label>
                        <Input
                          id={`var-${variable}`}
                          value={previewVariables[variable] || ''}
                          onChange={(e) => setPreviewVariables({
                            ...previewVariables,
                            [variable]: e.target.value
                          })}
                          placeholder={`Enter ${variable}...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Send Test Email:</Label>
                <div className="flex gap-2">
                  <Input
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    type="email"
                  />
                  <Button 
                    onClick={() => handleTestEmail(selectedTemplate)}
                    disabled={testEmailMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {testEmailMutation.isPending ? 'Sending...' : 'Send Test'}
                  </Button>
                </div>
              </div>

              <div className="border rounded p-4 bg-gray-50">
                <Label>HTML Preview:</Label>
                <div 
                  className="mt-2 bg-white border rounded p-4"
                  dangerouslySetInnerHTML={{ 
                    __html: selectedTemplate.html.replace(
                      /\{\{(\w+)\}\}/g, 
                      (match, key) => previewVariables[key] || match
                    )
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}