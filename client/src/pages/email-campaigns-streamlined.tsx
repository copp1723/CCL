import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Clock, Users, Send } from "lucide-react";

interface EmailCampaignSettings {
  timing: {
    step1Delay: number;
    step2Delay: number;
    step3Delay: number;
  };
}

interface EmailCampaign {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("Live Demo Campaign");
  const [timingSettings, setTimingSettings] = useState({
    step1Delay: 30,
    step2Delay: 180,
    step3Delay: 720,
  });

  const { data: settings } = useQuery<EmailCampaignSettings>({
    queryKey: ["/api/email-campaigns/settings"],
    refetchInterval: 60000,
  });

  const { data: campaigns = [] } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/email-campaigns"],
    refetchInterval: 30000,
  });

  const bulkEmailMutation = useMutation({
    mutationFn: async (data: { campaignName: string; data: any[] }) => {
      return apiRequest("/api/email-campaigns/bulk-send", {
        method: "POST",
        data: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Campaign Launched",
        description: `${campaignName} campaign processing started`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
    },
    onError: (error: any) => {
      toast({
        title: "Campaign Failed",
        description: error.message || "Failed to launch campaign",
        variant: "destructive",
      });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("/api/email-campaigns/settings", {
        method: "POST",
        data: settings,
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Email timing configuration updated",
      });
    },
  });

  const handleBulkCampaign = () => {
    const mockData = [
      { email: "customer1@example.com", abandonmentStep: 1, vehicleInterest: "Honda Civic" },
      { email: "customer2@example.com", abandonmentStep: 2, vehicleInterest: "Toyota Camry" },
      { email: "customer3@example.com", abandonmentStep: 3, vehicleInterest: "Ford F-150" },
    ];

    bulkEmailMutation.mutate({
      campaignName,
      data: mockData,
    });
  };

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      timing: timingSettings,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
        <p className="text-muted-foreground">
          Manage Cathy's email re-engagement campaigns and automation settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campaign Launch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Launch Campaign
            </CardTitle>
            <CardDescription>
              Send personalized emails using Cathy's sub-prime expertise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
              />
            </div>

            <Button
              onClick={handleBulkCampaign}
              disabled={bulkEmailMutation.isPending}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              {bulkEmailMutation.isPending ? "Launching..." : "Launch Bulk Campaign"}
            </Button>
          </CardContent>
        </Card>

        {/* Timing Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timing Configuration
            </CardTitle>
            <CardDescription>Configure delays between Cathy's email sequence steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="step1">Step 1 (minutes)</Label>
                <Input
                  id="step1"
                  type="number"
                  value={timingSettings.step1Delay}
                  onChange={e =>
                    setTimingSettings(prev => ({
                      ...prev,
                      step1Delay: parseInt(e.target.value) || 30,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="step2">Step 2 (minutes)</Label>
                <Input
                  id="step2"
                  type="number"
                  value={timingSettings.step2Delay}
                  onChange={e =>
                    setTimingSettings(prev => ({
                      ...prev,
                      step2Delay: parseInt(e.target.value) || 180,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="step3">Step 3 (minutes)</Label>
                <Input
                  id="step3"
                  type="number"
                  value={timingSettings.step3Delay}
                  onChange={e =>
                    setTimingSettings(prev => ({
                      ...prev,
                      step3Delay: parseInt(e.target.value) || 720,
                    }))
                  }
                />
              </div>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save Timing Configuration"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Campaign History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Campaign History
          </CardTitle>
          <CardDescription>Recent email campaigns and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map(campaign => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{campaign.name}</h3>
                    <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Recipients: {campaign.totalRecipients}</span>
                    <span>Sent: {campaign.emailsSent}</span>
                    <span>Open: {campaign.openRate}%</span>
                    <span>Click: {campaign.clickRate}%</span>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No campaigns launched yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
