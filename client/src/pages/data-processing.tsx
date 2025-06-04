import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Database, 
  Upload, 
  Zap, 
  Webhook, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Send,
  Activity,
  BarChart3
} from "lucide-react";

export default function DataProcessing() {
  const { toast } = useToast();
  const [bulkData, setBulkData] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [realTimeEmail, setRealTimeEmail] = useState("");
  const [realTimePhone, setRealTimePhone] = useState("");
  const [webhookData, setWebhookData] = useState("");
  const [dealerKey, setDealerKey] = useState("");

  // Fetch system stats
  const { data: stats } = useQuery({
    queryKey: ['/api/system/stats'],
    refetchInterval: 10000,
  });

  // Bulk Dataset API Mutation
  const bulkMutation = useMutation({
    mutationFn: async (data: { campaignName: string; data: any[] }) => {
      const response = await fetch('/api/email-campaigns/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to process bulk data');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Bulk Processing Complete",
        description: `${result.results?.successful || 0} records processed successfully`,
      });
      setBulkData("");
      setCampaignName("");
      queryClient.invalidateQueries({ queryKey: ['/api/system/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Bulk Processing Failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  // Real-time Lead Processing Mutation
  const realTimeMutation = useMutation({
    mutationFn: async (data: { email: string; phone?: string; abandonmentStep: number }) => {
      const response = await fetch('/api/leads/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to process real-time lead');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Lead Processed",
        description: `Lead ${result.leadId} processed and email automation triggered`,
      });
      setRealTimeEmail("");
      setRealTimePhone("");
      queryClient.invalidateQueries({ queryKey: ['/api/system/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Lead Processing Failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  // Webhook Integration Mutation
  const webhookMutation = useMutation({
    mutationFn: async (data: { dealerKey: string; leads: any[] }) => {
      const response = await fetch('/api/webhook/dealer-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to process webhook');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Webhook Processed",
        description: `${result.results?.successful || 0} leads received from dealer`,
      });
      setWebhookData("");
      setDealerKey("");
      queryClient.invalidateQueries({ queryKey: ['/api/system/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Webhook Failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const handleBulkProcess = () => {
    if (!bulkData || !campaignName) {
      toast({
        title: "Missing Information",
        description: "Please provide campaign name and CSV data",
        variant: "destructive",
      });
      return;
    }

    try {
      const lines = bulkData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        return record;
      });

      bulkMutation.mutate({ campaignName, data });
    } catch (error) {
      toast({
        title: "CSV Parse Error",
        description: "Please check your CSV format",
        variant: "destructive",
      });
    }
  };

  const handleRealTimeProcess = () => {
    if (!realTimeEmail) {
      toast({
        title: "Missing Email",
        description: "Please provide an email address",
        variant: "destructive",
      });
      return;
    }

    realTimeMutation.mutate({
      email: realTimeEmail,
      phone: realTimePhone,
      abandonmentStep: 1
    });
  };

  const handleWebhookProcess = () => {
    if (!dealerKey || !webhookData) {
      toast({
        title: "Missing Information", 
        description: "Please provide dealer key and lead data",
        variant: "destructive",
      });
      return;
    }

    try {
      const leads = JSON.parse(webhookData);
      webhookMutation.mutate({ dealerKey, leads: Array.isArray(leads) ? leads : [leads] });
    } catch (error) {
      toast({
        title: "JSON Parse Error",
        description: "Please check your JSON format",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Processing</h1>
          <p className="text-muted-foreground">
            Three flexible APIs for ingesting leads and triggering automated workflows
          </p>
        </div>
        <div className="flex space-x-2">
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Activity className="mr-1 h-3 w-3" />
            {stats?.leads || 0} Leads
          </Badge>
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <BarChart3 className="mr-1 h-3 w-3" />
            {stats?.activities || 0} Activities
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leads || 0}</div>
            <p className="text-xs text-muted-foreground">Processed through all APIs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.uptime ? Math.floor(stats.uptime / 60) : 0}m
            </div>
            <p className="text-xs text-muted-foreground">Server running time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.memory ? Math.round(stats.memory.heapUsed / 1024 / 1024) : 0}MB
            </div>
            <p className="text-xs text-muted-foreground">Heap memory used</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bulk" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bulk">Bulk Dataset API</TabsTrigger>
          <TabsTrigger value="realtime">Real-time Processing</TabsTrigger>
          <TabsTrigger value="webhook">Dealer Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="mr-2 h-5 w-5" />
                Bulk Dataset API
              </CardTitle>
              <CardDescription>
                Most reliable method for processing large CSV datasets with batch error handling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bulk-campaign">Campaign Name</Label>
                <Input
                  id="bulk-campaign"
                  placeholder="e.g., April Lead Import"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="bulk-csv">CSV Data</Label>
                <Textarea
                  id="bulk-csv"
                  placeholder="email_hash,phone,abandonment_step,dealer_name
customer1@example.com,555-1234,2,Kunes Auto Group
customer2@example.com,555-5678,1,Downtown Motors"
                  className="min-h-32 font-mono text-sm"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Endpoint:</strong> POST /api/email-campaigns/bulk-send
                </p>
              </div>

              <Button 
                onClick={handleBulkProcess}
                disabled={bulkMutation.isPending}
                className="w-full"
              >
                {bulkMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing Bulk Data...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Process Bulk Dataset
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5" />
                Real-time Lead Processing
              </CardTitle>
              <CardDescription>
                Immediate processing for individual leads with instant email automation triggers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rt-email">Customer Email</Label>
                <Input
                  id="rt-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={realTimeEmail}
                  onChange={(e) => setRealTimeEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="rt-phone">Phone Number (Optional)</Label>
                <Input
                  id="rt-phone"
                  placeholder="555-123-4567"
                  value={realTimePhone}
                  onChange={(e) => setRealTimePhone(e.target.value)}
                />
              </div>

              <div className="text-xs text-muted-foreground p-3 bg-gray-50 rounded">
                <strong>Endpoint:</strong> POST /api/leads/process<br/>
                <strong>Use case:</strong> CRM integration, form abandonment triggers, real-time events
              </div>

              <Button 
                onClick={handleRealTimeProcess}
                disabled={realTimeMutation.isPending}
                className="w-full"
              >
                {realTimeMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing Lead...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Process Real-time Lead
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Webhook className="mr-2 h-5 w-5" />
                Dealer Webhook Integration
              </CardTitle>
              <CardDescription>
                Authenticated endpoint for dealer partners to push leads automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="dealer-key">Dealer Authentication Key</Label>
                <Input
                  id="dealer-key"
                  placeholder="dealer_key_123456"
                  value={dealerKey}
                  onChange={(e) => setDealerKey(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="webhook-data">Lead Data (JSON)</Label>
                <Textarea
                  id="webhook-data"
                  placeholder='[
  {
    "email": "customer@example.com",
    "phone": "555-1234",
    "dealership": "Auto World",
    "vehicle_interest": "2024 Honda Civic"
  }
]'
                  className="min-h-32 font-mono text-sm"
                  value={webhookData}
                  onChange={(e) => setWebhookData(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Endpoint:</strong> POST /api/webhook/dealer-leads
                </p>
              </div>

              <Button 
                onClick={handleWebhookProcess}
                disabled={webhookMutation.isPending}
                className="w-full"
              >
                {webhookMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing Webhook...
                  </>
                ) : (
                  <>
                    <Webhook className="mr-2 h-4 w-4" />
                    Process Webhook Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration Examples</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium">cURL Example:</h4>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
{`curl -X POST https://your-domain.replit.app/api/webhook/dealer-leads \\
  -H "Content-Type: application/json" \\
  -d '{
    "dealerKey": "your_dealer_key",
    "leads": [
      {
        "email": "customer@example.com",
        "phone": "555-1234",
        "source": "website_form"
      }
    ]
  }'`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium">Response Format:</h4>
                  <pre className="bg-gray-100 p-2 rounded text-xs">
{`{
  "success": true,
  "message": "Webhook processed: 1 leads created",
  "results": {
    "processed": 1,
    "successful": 1,
    "failed": 0,
    "leadIds": ["lead_1_1234567890"]
  }
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}