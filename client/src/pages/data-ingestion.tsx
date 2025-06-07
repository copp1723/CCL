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

  // Fetch leads data for stats
  const { data: leadsData } = useQuery({
    queryKey: ['/api/leads'],
  });

  // CSV upload mutation using working bulk email endpoint
  const csvUploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('campaignName', `CSV Upload ${new Date().toISOString().split('T')[0]}`);
      formData.append('scheduleType', 'immediate');
      
      return fetch('/api/bulk-email/send', {
        method: 'POST',
        body: formData
      }).then(response => {
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        return response.json();
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "CSV Upload Complete",
        description: `Processed ${data.data?.processed || 0} leads successfully`,
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

  // Manual lead processing
  const manualUploadMutation = useMutation({
    mutationFn: (leads: Lead[]) => {
      return Promise.all(leads.map(lead => 
        apiRequest('/api/process-lead', {
          method: 'POST',
          data: {
            email: lead.email,
            firstName: lead.firstName,
            lastName: lead.lastName,
            vehicleInterest: lead.vehicleInterest
          }
        })
      ));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Manual Upload Complete",
        description: `Processed ${data.length} leads successfully`,
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
    const validLeads = manualLeads.filter(lead => lead.email && lead.firstName && lead.lastName);
    if (validLeads.length === 0) {
      toast({
        title: "Error",
        description: "Please provide at least one complete lead (email, first name, last name required)",
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
    setManualLeads(manualLeads.filter((_, i) => i !== index));
  };

  const updateManualLead = (index: number, field: keyof Lead, value: string) => {
    const updated = [...manualLeads];
    updated[index] = { ...updated[index], [field]: value };
    setManualLeads(updated);
  };

  const totalLeads = leadsData?.data?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Ingestion</h1>
        <p className="text-muted-foreground">Upload lead data via CSV or manual entry</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upload Status</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {csvUploadMutation.isPending || manualUploadMutation.isPending ? 'Processing' : 'Ready'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Upload</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {csvFile ? 'CSV Ready' : 'None'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="csv" className="space-y-4">
        <TabsList>
          <TabsTrigger value="csv">CSV Upload</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CSV File Upload</CardTitle>
              <CardDescription>
                Upload a CSV file with lead data. Expected columns: email, firstName, lastName, phone, vehicleInterest, creditScore
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csvFile">CSV File</Label>
                <Input
                  id="csvFile"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>
              
              {csvFile && (
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium">Selected File:</h4>
                  <p className="text-sm text-muted-foreground">{csvFile.name}</p>
                  <p className="text-sm text-muted-foreground">Size: {(csvFile.size / 1024).toFixed(2)} KB</p>
                </div>
              )}

              <Button 
                onClick={handleCsvUpload} 
                disabled={!csvFile || csvUploadMutation.isPending}
                className="w-full"
              >
                {csvUploadMutation.isPending ? 'Processing...' : 'Upload CSV'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual Lead Entry</CardTitle>
              <CardDescription>
                Enter lead information manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualLeads.map((lead, index) => (
                <div key={index} className="rounded-lg border p-4 space-y-4">
                  <div className="flex justify-between items-center">
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`email-${index}`}>Email *</Label>
                      <Input
                        id={`email-${index}`}
                        type="email"
                        value={lead.email}
                        onChange={(e) => updateManualLead(index, 'email', e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`firstName-${index}`}>First Name *</Label>
                      <Input
                        id={`firstName-${index}`}
                        value={lead.firstName}
                        onChange={(e) => updateManualLead(index, 'firstName', e.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`lastName-${index}`}>Last Name *</Label>
                      <Input
                        id={`lastName-${index}`}
                        value={lead.lastName}
                        onChange={(e) => updateManualLead(index, 'lastName', e.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`phoneNumber-${index}`}>Phone Number</Label>
                      <Input
                        id={`phoneNumber-${index}`}
                        value={lead.phoneNumber || ''}
                        onChange={(e) => updateManualLead(index, 'phoneNumber', e.target.value)}
                        placeholder="555-0123"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor={`vehicleInterest-${index}`}>Vehicle Interest</Label>
                      <Input
                        id={`vehicleInterest-${index}`}
                        value={lead.vehicleInterest}
                        onChange={(e) => updateManualLead(index, 'vehicleInterest', e.target.value)}
                        placeholder="Toyota Camry"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor={`notes-${index}`}>Notes</Label>
                      <Textarea
                        id={`notes-${index}`}
                        value={lead.notes || ''}
                        onChange={(e) => updateManualLead(index, 'notes', e.target.value)}
                        placeholder="Additional notes..."
                        rows={2}
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
                  {manualUploadMutation.isPending ? 'Processing...' : 'Upload Leads'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}