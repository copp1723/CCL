import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Mail, 
  Send, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  TrendingUp,
  FileText,
  Download,
  Settings
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  emailsSent: number;
  totalRecipients: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
  subject: string;
}

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [csvData, setCsvData] = useState("");
  const [timingSettings, setTimingSettings] = useState({
    step1_delay: 24,
    step2_delay: 72,
    step3_delay: 168
  });

  // Fetch campaign data
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['/api/email-campaigns'],
    refetchInterval: 30000,
  });

  // Fetch campaign settings
  const { data: settings } = useQuery({
    queryKey: ['/api/email-campaigns/settings'],
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (settings?.timing) {
      setTimingSettings(settings.timing);
    }
  }, [settings]);

  // Bulk email campaign mutation
  const bulkEmailMutation = useMutation({
    mutationFn: async (data: { campaignName: string; data: any[]; settings?: any }) => {
      const response = await fetch('/api/email-campaigns/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to send bulk emails');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Bulk Campaign Launched",
        description: `${result.results?.successful || 0} emails queued successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns'] });
      setCampaignName("");
      setCsvData("");
    },
    onError: (error) => {
      toast({
        title: "Campaign Failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  // Settings update mutation
  const settingsUpdateMutation = useMutation({
    mutationFn: async (data: { timing: any; templates?: any }) => {
      const response = await fetch('/api/email-campaigns/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Campaign timing and templates have been saved",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns/settings'] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const handleBulkSend = () => {
    if (!campaignName || !csvData) {
      toast({
        title: "Missing Information",
        description: "Please provide campaign name and CSV data",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse CSV data
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        return record;
      });

      bulkEmailMutation.mutate({
        campaignName,
        data,
        settings: { timing: timingSettings }
      });
    } catch (error) {
      toast({
        title: "CSV Parse Error",
        description: "Please check your CSV format",
        variant: "destructive",
      });
    }
  };

  const sampleCampaigns: Campaign[] = [
    {
      id: "1",
      name: "March Abandonment Recovery",
      status: "completed",
      emailsSent: 1250,
      totalRecipients: 1500,
      openRate: 32.5,
      clickRate: 8.2,
      createdAt: "2024-03-15",
      subject: "Complete Your Auto Loan Application - Cathy from CCL"
    },
    {
      id: "2", 
      name: "Subprime Re-engagement",
      status: "active",
      emailsSent: 750,
      totalRecipients: 2100,
      openRate: 28.7,
      clickRate: 6.8,
      createdAt: "2024-04-01",
      subject: "Your Pre-Approval is Ready - Don't Miss Out"
    }
  ];

  const displayCampaigns = campaigns || sampleCampaigns;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">
            Manage Mailgun email re-engagement campaigns with Cathy's personalized messaging
          </p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <Mail className="mr-1 h-3 w-3" />
          Mailgun Active
        </Badge>
      </div>

      <Tabs defaultValue="bulk-send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bulk-send">Bulk Campaign</TabsTrigger>
          <TabsTrigger value="campaigns">Active Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="timing">Timing Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="bulk-send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="mr-2 h-5 w-5" />
                Bulk Email Campaign
              </CardTitle>
              <CardDescription>
                Upload CSV data to trigger personalized re-engagement emails via Mailgun
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  placeholder="e.g., April Abandonment Recovery"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="csvData">CSV Data</Label>
                <Textarea
                  id="csvData"
                  placeholder="email_hash,phone,abandonment_step,dealer_name
john.doe@example.com,555-1234,2,Kunes Auto Group
jane.smith@example.com,555-5678,1,Downtown Motors"
                  className="min-h-32 font-mono text-sm"
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported fields: email_hash, phone, abandonment_step, dealer_name, etc.
                </p>
              </div>

              <Button 
                onClick={handleBulkSend}
                disabled={bulkEmailMutation.isPending}
                className="w-full"
              >
                {bulkEmailMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing Campaign...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Launch Bulk Campaign
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{displayCampaigns.length}</div>
                <p className="text-xs text-muted-foreground">Active email campaigns</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {displayCampaigns.reduce((acc, c) => acc + c.emailsSent, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Total emails delivered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(displayCampaigns.reduce((acc, c) => acc + c.openRate, 0) / displayCampaigns.length).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Email engagement rate</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Recent email campaign results and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {displayCampaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{campaign.name}</h3>
                          <Badge variant={
                            campaign.status === 'active' ? 'default' :
                            campaign.status === 'completed' ? 'secondary' :
                            campaign.status === 'paused' ? 'outline' : 'secondary'
                          }>
                            {campaign.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {campaign.subject}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <span>
                            <Users className="inline h-3 w-3 mr-1" />
                            {campaign.emailsSent}/{campaign.totalRecipients} sent
                          </span>
                          <span>Open: {campaign.openRate}%</span>
                          <span>Click: {campaign.clickRate}%</span>
                        </div>
                        <Progress 
                          value={(campaign.emailsSent / campaign.totalRecipients) * 100} 
                          className="mt-2 h-2"
                        />
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Cathy's personalized email templates for different abandonment scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Step 1: Initial Abandonment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Subject:</strong> "Don't lose your pre-approval - Cathy from Complete Car Loans"
                    </p>
                    <p className="text-sm">
                      Hi there! I noticed you started your auto loan application but didn't finish. 
                      As your personal finance advisor, I want to make sure you don't miss out on 
                      your pre-approval opportunity...
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Step 2: Follow-up</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Subject:</strong> "Your financing is waiting - Let's finish this together"
                    </p>
                    <p className="text-sm">
                      I'm Cathy, and I've been helping folks like you secure affordable auto loans 
                      for over 15 years. I see you're still considering your options, and I'd love 
                      to help you complete your application...
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Step 3: Final Outreach</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Subject:</strong> "Last chance for your special rate - Cathy here"
                    </p>
                    <p className="text-sm">
                      This is my final personal outreach to you. I understand that financing 
                      decisions take time, but I don't want you to miss this opportunity. 
                      Your pre-approval expires soon...
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Subprime Specialized</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Subject:</strong> "Good news about your credit situation"
                    </p>
                    <p className="text-sm">
                      I've been working with people in credit rebuilding situations for years, 
                      and I have some encouraging news about your application. We specialize 
                      in second-chance financing...
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Email Campaign Timing Configuration
              </CardTitle>
              <CardDescription>
                Customize when emails are sent in the abandonment recovery sequence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <Label htmlFor="step1-delay">Step 1: Initial Outreach</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      id="step1-delay"
                      type="number"
                      value={timingSettings.step1_delay}
                      onChange={(e) => setTimingSettings(prev => ({
                        ...prev,
                        step1_delay: parseInt(e.target.value) || 24
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">hours after abandonment</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    "Don't lose your pre-approval - Cathy from Complete Car Loans"
                  </p>
                </div>

                <div>
                  <Label htmlFor="step2-delay">Step 2: Follow-up</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      id="step2-delay"
                      type="number"
                      value={timingSettings.step2_delay}
                      onChange={(e) => setTimingSettings(prev => ({
                        ...prev,
                        step2_delay: parseInt(e.target.value) || 72
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">hours after abandonment</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    "Your financing is waiting - Let's finish this together"
                  </p>
                </div>

                <div>
                  <Label htmlFor="step3-delay">Step 3: Final Attempt</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      id="step3-delay"
                      type="number"
                      value={timingSettings.step3_delay}
                      onChange={(e) => setTimingSettings(prev => ({
                        ...prev,
                        step3_delay: parseInt(e.target.value) || 168
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">hours after abandonment</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    "Last chance for your special rate - Cathy here"
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900">Current Sequence:</h4>
                  <p className="text-sm text-blue-700">
                    Email 1 after {timingSettings.step1_delay}h → Email 2 after {timingSettings.step2_delay}h → Email 3 after {timingSettings.step3_delay}h
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => settingsUpdateMutation.mutate({ timing: timingSettings })}
                disabled={settingsUpdateMutation.isPending}
                className="w-full"
              >
                {settingsUpdateMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Saving Settings...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Save Timing Configuration
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mailgun Integration Status</CardTitle>
              <CardDescription>Email delivery system configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Mailgun Domain</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {settings?.mailgun?.domain || "Configured"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Service</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cathy's Personality</span>
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    Enabled
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}