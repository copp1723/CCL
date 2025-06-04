import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlayCircle, Download, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TestScenario {
  name: string;
  description: string;
}

interface TestResult {
  scenario: string;
  description: string;
  steps: TestStepResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface TestStepResult {
  step: string;
  description: string;
  expectedOutcome: string;
  result?: any;
  error?: string;
  duration: number;
  status: 'success' | 'error';
}

export default function TestingPage() {
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const queryClient = useQueryClient();

  // Fetch available test scenarios
  const { data: scenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ['/api/test/scenarios'],
    select: (data: any) => data.scenarios as string[]
  });

  // Fetch detailed metrics
  const { data: detailedMetrics } = useQuery({
    queryKey: ['/api/metrics/detailed'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Run single scenario mutation
  const runScenarioMutation = useMutation({
    mutationFn: async (scenarioName: string) => {
      return await apiRequest(`/api/test/run-scenario`, 'POST', { scenarioName });
    },
    onSuccess: (result) => {
      setTestResults(prev => [result, ...prev.filter(r => r.scenario !== result.scenario)]);
      queryClient.invalidateQueries({ queryKey: ['/api/metrics/detailed'] });
    }
  });

  // Run all scenarios mutation
  const runAllScenariosMutation = useMutation({
    mutationFn: async () => {
      setIsRunningAll(true);
      return await apiRequest(`/api/test/run-all`, 'POST');
    },
    onSuccess: (results) => {
      setTestResults(results.scenarios);
      setIsRunningAll(false);
      queryClient.invalidateQueries({ queryKey: ['/api/metrics/detailed'] });
    },
    onError: () => {
      setIsRunningAll(false);
    }
  });

  // Generate sample data mutation
  const generateDataMutation = useMutation({
    mutationFn: async (count: number) => {
      return await apiRequest(`/api/test/generate-sample-data`, 'POST', { count });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
    }
  });

  const handleRunScenario = (scenarioName: string) => {
    runScenarioMutation.mutate(scenarioName);
  };

  const handleRunAllScenarios = () => {
    runAllScenariosMutation.mutate();
  };

  const handleGenerateData = (count: number) => {
    generateDataMutation.mutate(count);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'secondary';
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Testing & Validation</h1>
          <p className="text-muted-foreground">
            End-to-end testing for the multi-agent auto-loan recovery system
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleGenerateData(25)}
            disabled={generateDataMutation.isPending}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Test Data
          </Button>
          <Button
            onClick={handleRunAllScenarios}
            disabled={isRunningAll || runAllScenariosMutation.isPending}
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Run All Tests
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scenariosLoading ? (
              <div className="col-span-3 text-center py-8">Loading scenarios...</div>
            ) : (
              scenarios?.map((scenario) => (
                <Card key={scenario} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{scenario}</CardTitle>
                    <CardDescription>
                      {scenario === 'Happy Path Journey' && 'Complete journey from abandonment to successful lead submission'}
                      {scenario === 'Abandonment Recovery' && 'Customer abandons, gets email, returns from different device'}
                      {scenario === 'Credit Decline Handling' && 'Customer with poor credit gets alternative options'}
                      {scenario === 'Edge Cases & Data Validation' && 'Test system resilience with invalid/malicious data'}
                      {scenario === 'High Volume Load Test' && 'Simulate concurrent operations to test system capacity'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => handleRunScenario(scenario)}
                      disabled={runScenarioMutation.isPending}
                      className="w-full"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Run Test
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {testResults.length === 0 ? (
            <Alert>
              <AlertDescription>
                No test results yet. Run a test scenario to see results here.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <Card key={`${result.scenario}-${index}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{result.scenario}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={result.summary.failed > 0 ? 'destructive' : 'default'}>
                          {result.summary.successful}/{result.summary.total} passed
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{result.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {result.steps.map((step, stepIndex) => (
                          <div key={stepIndex} className="flex items-start gap-3 p-3 rounded border">
                            {getStatusIcon(step.status)}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{step.step}</h4>
                                <span className="text-sm text-muted-foreground">
                                  {step.duration}ms
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                              <p className="text-sm">{step.expectedOutcome}</p>
                              {step.error && (
                                <Alert className="mt-2">
                                  <AlertDescription className="text-sm">
                                    {step.error}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {detailedMetrics && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {detailedMetrics.failureRates?.overallErrorRate?.toFixed(1) || 0}%
                    </div>
                    <Progress value={detailedMetrics.failureRates?.overallErrorRate || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Email Failure Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {detailedMetrics.failureRates?.emailFailureRate?.toFixed(1) || 0}%
                    </div>
                    <Progress value={detailedMetrics.failureRates?.emailFailureRate || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Credit Check Failures</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {detailedMetrics.failureRates?.creditCheckFailureRate?.toFixed(1) || 0}%
                    </div>
                    <Progress value={detailedMetrics.failureRates?.creditCheckFailureRate || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">P95 Response Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {detailedMetrics.latencyMetrics?.p95ResponseTime?.toFixed(1) || 0}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg: {detailedMetrics.latencyMetrics?.avgChatResponseTime?.toFixed(1) || 0}ms
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Throughput Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Visitor Events/Hour:</span>
                      <span className="font-bold">{detailedMetrics.throughput?.visitorEventsPerHour || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Emails Sent/Hour:</span>
                      <span className="font-bold">{detailedMetrics.throughput?.emailsSentPerHour || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Leads Generated/Hour:</span>
                      <span className="font-bold">{detailedMetrics.throughput?.leadsGeneratedPerHour || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Latency Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Chat Response:</span>
                      <span className="font-bold">{detailedMetrics.latencyMetrics?.avgChatResponseTime?.toFixed(1) || 0}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email Delivery:</span>
                      <span className="font-bold">{detailedMetrics.latencyMetrics?.emailDeliveryTime?.toFixed(1) || 0}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Credit Check:</span>
                      <span className="font-bold">{detailedMetrics.latencyMetrics?.creditCheckTime?.toFixed(1) || 0}s</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}