import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, CheckCircle, AlertCircle, Users, MessageSquare } from "lucide-react";

interface ProcessedResult {
  customer: any;
  message: any;
  validation: {
    valid: boolean;
    issues: string[];
  };
}

interface ProcessingResponse {
  success: boolean;
  totalRecords: number;
  processedCount: number;
  errorCount: number;
  processed: ProcessedResult[];
  errors: Array<{
    index: number;
    error: string;
    data: any;
  }>;
}

export function CSVProcessor() {
  const [csvText, setCsvText] = useState("");
  const [messageType, setMessageType] = useState<"reengagement" | "inmarket" | "followup">("reengagement");
  const [selectedRecord, setSelectedRecord] = useState<ProcessedResult | null>(null);
  const queryClient = useQueryClient();

  const processCsvMutation = useMutation({
    mutationFn: async ({ csvData, messageType }: { csvData: any[], messageType: string }) => {
      return apiRequest(`/api/data-mapping/process-csv`, {
        method: "POST",
        body: JSON.stringify({ csvData, messageType }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
    }
  });

  const testMessageQuery = useQuery({
    queryKey: ['/api/data-mapping/test-message'],
    queryFn: () => apiRequest('/api/data-mapping/test-message')
  });

  const handleProcessCSV = () => {
    if (!csvText.trim()) return;

    try {
      // Parse CSV text into JSON
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const csvData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        return record;
      });

      processCsvMutation.mutate({ csvData, messageType });
    } catch (error) {
      console.error('Error parsing CSV:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const result = processCsvMutation.data as ProcessingResponse | undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Data Processing
          </CardTitle>
          <CardDescription>
            Process dealer CSV data to generate personalized Complete Car Loans messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={messageType} onValueChange={(value: any) => setMessageType(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Message Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reengagement">Re-engagement</SelectItem>
                <SelectItem value="inmarket">In-Market Shoppers</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span className="cursor-pointer flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload CSV
                  </span>
                </Button>
              </label>
            </div>
          </div>

          <Textarea
            placeholder="Paste CSV data here or upload a file..."
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="min-h-32 font-mono text-sm"
          />

          <Button 
            onClick={handleProcessCSV}
            disabled={!csvText.trim() || processCsvMutation.isPending}
            className="w-full"
          >
            {processCsvMutation.isPending ? "Processing..." : "Process CSV Data"}
          </Button>

          {processCsvMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error processing CSV: {(processCsvMutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Processing Results
            </CardTitle>
            <div className="flex gap-4">
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {result.totalRecords} Total Records
              </Badge>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                {result.processedCount} Processed
              </Badge>
              {result.errorCount > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {result.errorCount} Errors
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="processed" className="w-full">
              <TabsList>
                <TabsTrigger value="processed">Processed Records ({result.processedCount})</TabsTrigger>
                {result.errorCount > 0 && (
                  <TabsTrigger value="errors">Errors ({result.errorCount})</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="processed" className="space-y-4">
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {result.processed.map((record, index) => (
                      <Card key={index} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRecord(record)}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">
                                {record.customer.firstName} {record.customer.lastName}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {record.customer.dealer} • {record.customer.city}, {record.customer.state}
                              </p>
                              {record.customer.vehicleYear && (
                                <p className="text-sm text-muted-foreground">
                                  {record.customer.vehicleYear} {record.customer.vehicleMake} {record.customer.vehicleModel}
                                </p>
                              )}
                            </div>
                            <Badge variant={record.validation.valid ? "default" : "secondary"}>
                              {record.validation.valid ? "Valid" : "Issues"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {result.errorCount > 0 && (
                <TabsContent value="errors" className="space-y-4">
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {result.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Row {error.index + 1}:</strong> {error.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {selectedRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Generated Message Preview
            </CardTitle>
            <CardDescription>
              Message for {selectedRecord.customer.firstName} {selectedRecord.customer.lastName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm">
                {selectedRecord.message.fullMessage}
              </pre>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Customer Details (Safe for Prompts)</h4>
                <div className="space-y-1">
                  <p><strong>Name:</strong> {selectedRecord.customer.firstName} {selectedRecord.customer.lastName}</p>
                  <p><strong>Location:</strong> {selectedRecord.customer.city}, {selectedRecord.customer.state}</p>
                  <p><strong>Dealer:</strong> {selectedRecord.customer.dealer}</p>
                  <p><strong>Lead Source:</strong> {selectedRecord.customer.leadSource}</p>
                  <p><strong>Lead Status:</strong> {selectedRecord.customer.leadStatus}</p>
                  {selectedRecord.customer.vehicleYear && (
                    <p><strong>Vehicle:</strong> {selectedRecord.customer.vehicleYear} {selectedRecord.customer.vehicleMake} {selectedRecord.customer.vehicleModel}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Private Data (Internal Only)</h4>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong>Email:</strong> {selectedRecord.customer.email ? '***@***.***' : 'Not provided'}</p>
                  <p><strong>Phone:</strong> {selectedRecord.customer.phone ? '***-***-****' : 'Not provided'}</p>
                  <p><strong>Address:</strong> {selectedRecord.customer.address ? '*** Private ***' : 'Not provided'}</p>
                </div>
                
                {selectedRecord.validation.issues.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2 text-amber-600">Validation Issues</h4>
                    <ul className="space-y-1 text-amber-600">
                      {selectedRecord.validation.issues.map((issue, index) => (
                        <li key={index} className="text-xs">• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {testMessageQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Sample Message (QA Test)</CardTitle>
            <CardDescription>
              Example output with test data for quality assurance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm">
                {testMessageQuery.data.message.fullMessage}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}