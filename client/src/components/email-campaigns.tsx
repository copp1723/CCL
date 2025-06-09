import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail,
  Send,
  Clock,
  Users,
  BarChart3,
  Play,
  Pause,
  Settings,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  MousePointer,
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  messageType: "reengagement" | "inmarket" | "followup";
  delayHours: number;
  isActive: boolean;
}

interface Campaign {
  id: string;
  name: string;
  templates: EmailTemplate[];
  targetAudience: "reengagement" | "inmarket" | "followup" | "all";
  isActive: boolean;
  createdAt: string;
  stats: {
    totalSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  };
}

interface CampaignMetrics {
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
}

export function EmailCampaigns() {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [csvData, setCsvData] = useState("");
  const [scheduleDelay, setScheduleDelay] = useState(0);
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ["/api/email-campaigns"],
    queryFn: () => apiRequest("/api/email-campaigns"),
  });

  const selectedCampaignQuery = useQuery({
    queryKey: ["/api/email-campaigns", selectedCampaign],
    queryFn: () => apiRequest(`/api/email-campaigns/${selectedCampaign}`),
    enabled: !!selectedCampaign,
  });

  const metricsQuery = useQuery({
    queryKey: ["/api/email-campaigns", selectedCampaign, "metrics"],
    queryFn: () => apiRequest(`/api/email-campaigns/${selectedCampaign}/metrics`),
    enabled: !!selectedCampaign,
  });

  const scheduledQuery = useQuery({
    queryKey: ["/api/email-campaigns", selectedCampaign, "scheduled"],
    queryFn: () => apiRequest(`/api/email-campaigns/${selectedCampaign}/scheduled`),
    enabled: !!selectedCampaign,
    refetchInterval: 30000,
  });

  const bulkSendMutation = useMutation({
    mutationFn: async (data: any) => {
      return fetch("/api/email-campaigns/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setCsvData("");
    },
  });

  const handleBulkSend = () => {
    if (!selectedCampaign || !csvData.trim()) return;

    try {
      const lines = csvData.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));

      const parsedData = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || "";
        });
        return record;
      });

      const campaign = campaignsQuery.data?.find((c: Campaign) => c.id === selectedCampaign);

      bulkSendMutation.mutate({
        campaignId: selectedCampaign,
        csvData: parsedData,
        messageType: campaign?.targetAudience || "reengagement",
        scheduleDelay,
      });
    } catch (error) {
      console.error("Error parsing CSV:", error);
    }
  };

  const campaigns = (campaignsQuery.data as Campaign[]) || [];
  const selectedCampaignData = selectedCampaignQuery.data as Campaign;
  const metrics = metricsQuery.data as CampaignMetrics;
  const scheduled = scheduledQuery.data || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Campaign Automation
          </CardTitle>
          <CardDescription>
            Automated email sequences using Complete Car Loans personalized messaging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaigns.map(campaign => (
              <Card
                key={campaign.id}
                className={`cursor-pointer transition-colors ${
                  selectedCampaign === campaign.id ? "ring-2 ring-blue-500" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedCampaign(campaign.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{campaign.name}</h3>
                    <Badge variant={campaign.isActive ? "default" : "secondary"}>
                      {campaign.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {campaign.templates.length} email templates
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      {campaign.stats.totalSent} sent
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {campaign.stats.opened} opened
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedCampaign && selectedCampaignData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Campaign Performance: {selectedCampaignData.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-semibold text-blue-700">{metrics.totalSent}</div>
                    <div className="text-sm text-blue-600">Total Sent</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-semibold text-green-700">
                      {(metrics.deliveryRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-green-600">Delivery Rate</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-semibold text-purple-700">
                      {(metrics.openRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-purple-600">Open Rate</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-semibold text-orange-700">
                      {(metrics.clickRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-orange-600">Click Rate</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-semibold text-red-700">
                      {(metrics.unsubscribeRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-red-600">Unsubscribe Rate</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Bulk Email Launch
                </CardTitle>
                <CardDescription>Upload CSV data to start automated email sequence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-delay">Schedule Delay (hours)</Label>
                  <Input
                    id="schedule-delay"
                    type="number"
                    min="0"
                    value={scheduleDelay}
                    onChange={e => setScheduleDelay(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay before starting the email sequence (0 = immediate)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="csv-data">CSV Data</Label>
                  <Textarea
                    id="csv-data"
                    placeholder="Paste CSV data here (First Name, Last Name, Email, Dealer, etc.)"
                    value={csvData}
                    onChange={e => setCsvData(e.target.value)}
                    className="min-h-32 font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleBulkSend}
                  disabled={!csvData.trim() || bulkSendMutation.isPending}
                  className="w-full"
                >
                  {bulkSendMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Launch Campaign
                    </>
                  )}
                </Button>

                {bulkSendMutation.data && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Campaign launched successfully! {bulkSendMutation.data.scheduled} emails
                      scheduled.
                      {bulkSendMutation.data.errors?.length > 0 && (
                        <span className="text-amber-600">
                          {" "}
                          ({bulkSendMutation.data.errors.length} records had errors)
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {bulkSendMutation.error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Error launching campaign: {(bulkSendMutation.error as Error).message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Scheduled Emails
                </CardTitle>
                <CardDescription>Upcoming email executions for this campaign</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {scheduled.length > 0 ? (
                    <div className="space-y-2">
                      {scheduled.map((execution: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-sm">
                              Customer: {execution.customerId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Template: {execution.templateId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Scheduled: {new Date(execution.scheduledAt).toLocaleString()}
                            </div>
                          </div>
                          <Badge
                            variant={
                              execution.status === "scheduled"
                                ? "secondary"
                                : execution.status === "sent"
                                  ? "default"
                                  : execution.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                            }
                          >
                            {execution.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No scheduled emails
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Configure email sequence templates for this campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedCampaignData.templates.map((template, index) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {index + 1}
                        </span>
                        <h4 className="font-medium">{template.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{template.delayHours}h delay</Badge>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Subject: {template.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Message Type: {template.messageType}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
