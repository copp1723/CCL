import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Play, Pause, Mail, Clock, Users, BarChart, Upload, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// API functions
const fetchCampaigns = async () => {
  const res = await fetch("/api/campaigns");
  if (!res.ok) throw new Error("Failed to fetch campaigns");
  return res.json();
};

const fetchBulkEmailSettings = async () => {
  const res = await fetch("/api/bulk-email/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
};

const createCampaign = async (data: any) => {
  const res = await fetch("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create campaign");
  return res.json();
};

const uploadCSV = async (file: File) => {
  const formData = new FormData();
  formData.append("csvFile", file);
  
  const res = await fetch("/api/bulk-email/send", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload CSV");
  return res.json();
};

export default function UnifiedCampaignsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  });

  const { data: settings } = useQuery({
    queryKey: ["bulk-email-settings"],
    queryFn: fetchBulkEmailSettings,
  });

  // Mutations
  const createCampaignMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCreateDialogOpen(false);
      toast({
        title: "Campaign created",
        description: "Your campaign has been created successfully",
      });
    },
  });

  const uploadCSVMutation = useMutation({
    mutationFn: uploadCSV,
    onSuccess: (data) => {
      toast({
        title: "CSV uploaded",
        description: `Successfully processed ${data.data?.processed || 0} leads`,
      });
      setSelectedFile(null);
    },
  });

  // Campaign stats
  const activeCampaigns = campaigns.filter((c: any) => c.status === "active").length;
  const totalRecipients = campaigns.reduce((sum: number, c: any) => sum + (c.totalRecipients || 0), 0);
  const avgOpenRate = campaigns.length > 0 
    ? (campaigns.reduce((sum: number, c: any) => sum + (c.openRate || 0), 0) / campaigns.length * 100).toFixed(1)
    : 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleCSVUpload = () => {
    if (selectedFile) {
      uploadCSVMutation.mutate(selectedFile);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campaign Management</h1>
          <p className="text-muted-foreground">Create and manage all your email campaigns</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up a new email campaign with AI-powered content
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createCampaignMutation.mutate({
                name: formData.get("name"),
                goal_prompt: formData.get("goal_prompt"),
                type: formData.get("type"),
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="type">Campaign Type</Label>
                <Select name="type" defaultValue="single">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Email</SelectItem>
                    <SelectItem value="sequence">Email Sequence</SelectItem>
                    <SelectItem value="drip">Drip Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="goal_prompt">AI Goal Prompt</Label>
                <Textarea 
                  id="goal_prompt" 
                  name="goal_prompt"
                  placeholder="E.g., Get customers excited about their auto financing options"
                  required 
                />
              </div>
              <Button type="submit" className="w-full">Create Campaign</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecipients.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgOpenRate}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Service</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings?.data?.mailgun?.configured ? "Connected" : "Not Setup"}
            </div>
            <p className="text-xs text-muted-foreground">
              {settings?.data?.mailgun?.domain || "Configure in settings"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Campaign Overview</TabsTrigger>
          <TabsTrigger value="sequences">Email Sequences</TabsTrigger>
          <TabsTrigger value="import">Import Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {campaignsLoading ? (
            <div>Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Mail className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No campaigns yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first campaign to get started</p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign: any) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <CardDescription>{campaign.goal_prompt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recipients:</span>
                        <span>{campaign.totalRecipients || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent:</span>
                        <span>{campaign.emailsSent || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Open Rate:</span>
                        <span>{((campaign.openRate || 0) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {campaign.status === "active" ? (
                        <Button variant="outline" size="sm" className="w-full">
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="w-full">
                          <Play className="mr-2 h-4 w-4" />
                          Start
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sequences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Sequence Settings</CardTitle>
              <CardDescription>Configure timing for multi-step email campaigns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Step 1 Delay (hours after trigger)</Label>
                <div className="flex items-center space-x-4">
                  <Slider
                    defaultValue={[settings?.data?.timing?.step1Delay || 24]}
                    max={72}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right">{settings?.data?.timing?.step1Delay || 24}h</span>
                </div>
              </div>
              <div>
                <Label>Step 2 Delay (hours after Step 1)</Label>
                <div className="flex items-center space-x-4">
                  <Slider
                    defaultValue={[settings?.data?.timing?.step2Delay || 72]}
                    max={168}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right">{settings?.data?.timing?.step2Delay || 72}h</span>
                </div>
              </div>
              <div>
                <Label>Step 3 Delay (hours after Step 2)</Label>
                <div className="flex items-center space-x-4">
                  <Slider
                    defaultValue={[settings?.data?.timing?.step3Delay || 168]}
                    max={336}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right">{settings?.data?.timing?.step3Delay || 168}h</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-start sequences</Label>
                  <p className="text-sm text-muted-foreground">Automatically begin sequences when leads are added</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Leads via CSV</CardTitle>
              <CardDescription>Upload a CSV file to import leads and start campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-upload">Select CSV File</Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV should include: email, firstname, lastname, phone (optional)
                  </p>
                </div>
                
                {selectedFile && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Selected file: {selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">Size: {(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                )}

                <Button 
                  onClick={handleCSVUpload}
                  disabled={!selectedFile || uploadCSVMutation.isPending}
                  className="w-full"
                >
                  {uploadCSVMutation.isPending ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload and Process
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Imports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No recent imports</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}