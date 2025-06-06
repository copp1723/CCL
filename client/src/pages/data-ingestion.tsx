import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, Mail, Database, Plus, Trash2 } from "lucide-react";

interface Lead {
  email: string;
  firstName: string;
  lastName: string;
  vehicleInterest: string;
  phoneNumber?: string;
  notes?: string;
}

export default function DataIngestion() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manualLeads, setManualLeads] = useState<Lead[]>([
    { email: '', firstName: '', lastName: '', vehicleInterest: '', phoneNumber: '', notes: '' }
  ]);

  // Fetch ingestion stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/data-ingestion/stats'],
  });

  // CSV upload mutation
  const csvUploadMutation = useMutation({
    mutationFn: (file: File) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const csvData = e.target?.result as string;
          const lines = csvData.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          
          const leads = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const lead: any = {};
            
            headers.forEach((header, index) => {
              if (header === 'email') lead.email = values[index];
              if (header === 'firstname' || header === 'first_name') lead.firstName = values[index];
              if (header === 'lastname' || header === 'last_name') lead.lastName = values[index];
              if (header === 'phone' || header === 'phonenumber' || header === 'phone_number') lead.phoneNumber = values[index];
              if (header === 'vehicle' || header === 'vehicleinterest' || header === 'vehicle_interest') lead.vehicleInterest = values[index];
              if (header === 'notes') lead.notes = values[index];
            });
            
            return lead;
          }).filter(lead => lead.email);
          
          apiRequest('/api/data-ingestion/leads/manual', {
            method: 'POST',
            data: { leads }
          }).then(resolve).catch(reject);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-ingestion/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "CSV Upload Complete",
        description: `Processed ${data.data?.totalProcessed || 0} leads: ${data.data?.successCount || 0} successful, ${data.data?.failureCount || 0} failed`,
      });
      setCsvFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload CSV file",
        variant: "destructive",
      });
    },
  });

  // Manual upload mutation
  const manualUploadMutation = useMutation({
    mutationFn: (leads: Lead[]) => apiRequest('/api/data-ingestion/leads/manual', {
      method: 'POST',
      data: { leads }
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-ingestion/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Manual Upload Complete",
        description: `Processed ${data.data?.totalProcessed || 0} leads: ${data.data?.successCount || 0} successful, ${data.data?.failureCount || 0} failed`,
      });
      setManualLeads([{ email: '', firstName: '', lastName: '', vehicleInterest: '', phoneNumber: '', notes: '' }]);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload leads",
        variant: "destructive",
      });
    },
  });

  const handleCsvUpload = () => {
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }
    csvUploadMutation.mutate(csvFile);
  };

  const handleManualUpload = () => {
    const validLeads = manualLeads.filter(lead => lead.email.trim() !== '');
    if (validLeads.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one lead with an email address",
        variant: "destructive",
      });
      return;
    }
    manualUploadMutation.mutate(validLeads);
  };

  const addManualLead = () => {
    setManualLeads([...manualLeads, { email: '', firstName: '', lastName: '', vehicleInterest: '', phoneNumber: '', notes: '' }]);
  };

  const removeManualLead = (index: number) => {
    if (manualLeads.length > 1) {
      setManualLeads(manualLeads.filter((_, i) => i !== index));
    }
  };

  const updateManualLead = (index: number, field: keyof Lead, value: string) => {
    const updated = [...manualLeads];
    updated[index] = { ...updated[index], [field]: value };
    setManualLeads(updated);
  };

  const stats = (statsData as any)?.data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Ingestion</h1>
          <p className="text-muted-foreground">
            Import lead data from various sources for campaign processing
          </p>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Imports</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentIngestionActivities || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.ingestionSources || {}).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Import</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {stats.lastIngestion ? new Date(stats.lastIngestion).toLocaleDateString() : 'None'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Sources Breakdown */}
      {stats.ingestionSources && Object.keys(stats.ingestionSources).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
            <CardDescription>Breakdown of leads by ingestion source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.ingestionSources || {}).map(([source, count]) => (
                <Badge key={source} variant="outline">
                  {source}: {count as number}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="csv" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="csv">CSV Upload</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="sftp">SFTP/API</TabsTrigger>
          <TabsTrigger value="email">Email Capture</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                CSV File Upload
              </CardTitle>
              <CardDescription>
                Upload a CSV file with lead data. Required columns: email. Optional: firstName, lastName, vehicleInterest, phoneNumber, notes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>
              {csvFile && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Selected file:</strong> {csvFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Size: {(csvFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}
              <Button 
                onClick={handleCsvUpload}
                disabled={!csvFile || csvUploadMutation.isPending}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {csvUploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Manual Lead Entry
              </CardTitle>
              <CardDescription>
                Manually enter lead information. Email address is required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualLeads.map((lead, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Lead {index + 1}</h4>
                    {manualLeads.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeManualLead(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={lead.email}
                        onChange={(e) => updateManualLead(index, 'email', e.target.value)}
                        placeholder="customer@example.com"
                      />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input
                        value={lead.phoneNumber || ''}
                        onChange={(e) => updateManualLead(index, 'phoneNumber', e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label>First Name</Label>
                      <Input
                        value={lead.firstName}
                        onChange={(e) => updateManualLead(index, 'firstName', e.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input
                        value={lead.lastName}
                        onChange={(e) => updateManualLead(index, 'lastName', e.target.value)}
                        placeholder="Smith"
                      />
                    </div>
                    <div>
                      <Label>Vehicle Interest</Label>
                      <Input
                        value={lead.vehicleInterest}
                        onChange={(e) => updateManualLead(index, 'vehicleInterest', e.target.value)}
                        placeholder="SUV, Truck, Sedan..."
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={lead.notes || ''}
                        onChange={(e) => updateManualLead(index, 'notes', e.target.value)}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={addManualLead}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Lead
                </Button>
                <Button 
                  onClick={handleManualUpload}
                  disabled={manualUploadMutation.isPending}
                  className="flex-1"
                >
                  {manualUploadMutation.isPending ? 'Processing...' : `Upload ${manualLeads.filter(l => l.email.trim()).length} Leads`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sftp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SFTP/API Integration</CardTitle>
              <CardDescription>
                Configure automated data ingestion from external sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">SFTP Webhook Endpoint</h4>
                <code className="text-sm bg-background p-2 rounded block">
                  POST /api/data-ingestion/leads/sftp-webhook
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Send lead data in JSON format with required API key authentication
                </p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Expected JSON Format</h4>
                <pre className="text-sm bg-background p-2 rounded overflow-x-auto">
{`{
  "fileName": "leads_batch_001.csv",
  "source": "dealer_portal",
  "leads": [
    {
      "email": "customer@example.com",
      "firstName": "John",
      "lastName": "Smith", 
      "vehicleInterest": "SUV",
      "phoneNumber": "(555) 123-4567",
      "metadata": {}
    }
  ]
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email-Based Lead Capture
              </CardTitle>
              <CardDescription>
                Capture leads from emails sent to designated addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Mailgun Webhook Endpoint</h4>
                <code className="text-sm bg-background p-2 rounded block">
                  POST /api/data-ingestion/leads/email-capture
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Automatically extracts lead information from incoming emails
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Email Processing Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Automatic phone number extraction</li>
                  <li>• Vehicle interest keyword detection</li>
                  <li>• Name pattern recognition</li>
                  <li>• Subject line analysis</li>
                </ul>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Setup Required:</strong> Configure Mailgun webhook to forward emails from leads@onerylie.com to this endpoint
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}