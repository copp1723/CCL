import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface TestResult {
  scenario: string;
  description: string;
  steps: Array<{
    step: string;
    status: 'success' | 'failure' | 'pending';
    details: string;
  }>;
  summary: {
    passed: number;
    failed: number;
    total: number;
    executionTime: number;
  };
}

interface TestMetrics {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  averageExecutionTime: number;
  overallSuccessRate: number;
}

export default function Testing() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testMetrics, setTestMetrics] = useState<TestMetrics>({
    totalScenarios: 0,
    passedScenarios: 0,
    failedScenarios: 0,
    averageExecutionTime: 0,
    overallSuccessRate: 0
  });

  const runSingleScenario = async (scenarioName: string) => {
    setIsRunning(true);
    setCurrentTest(scenarioName);
    
    try {
      const response = await fetch(`/api/test/scenario/${scenarioName}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run scenario: ${response.statusText}`);
      }
      
      const result = await response.json() as TestResult;
      
      setTestResults(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(r => r.scenario === result.scenario);
        if (existingIndex >= 0) {
          updated[existingIndex] = result;
        } else {
          updated.push(result);
        }
        return updated;
      });
      
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runAllScenarios = async () => {
    setIsRunning(true);
    setCurrentTest('All Scenarios');
    
    try {
      const response = await fetch('/api/test/all', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run all scenarios: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.scenarios && Array.isArray(data.scenarios)) {
        setTestResults(data.scenarios);
        
        // Calculate metrics
        const totalScenarios = data.scenarios.length;
        const passedScenarios = data.scenarios.filter((s: TestResult) => 
          s.summary.failed === 0
        ).length;
        const failedScenarios = totalScenarios - passedScenarios;
        const averageExecutionTime = data.scenarios.reduce((acc: number, s: TestResult) => 
          acc + s.summary.executionTime, 0
        ) / totalScenarios;
        const overallSuccessRate = (passedScenarios / totalScenarios) * 100;
        
        setTestMetrics({
          totalScenarios,
          passedScenarios,
          failedScenarios,
          averageExecutionTime,
          overallSuccessRate
        });
      }
      
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScenarioStatus = (result: TestResult) => {
    return result.summary.failed === 0 ? 'success' : 'failure';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Agent System Testing</h1>
          <p className="text-muted-foreground mt-2">
            End-to-end validation of multi-agent workflows and system reliability
          </p>
        </div>

        {/* Test Controls */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={() => runSingleScenario('happy-path')} 
                disabled={isRunning}
                className="w-full"
                size="sm"
              >
                <Play className="h-4 w-4 mr-2" />
                Happy Path
              </Button>
              <Button 
                onClick={() => runSingleScenario('abandonment-recovery')} 
                disabled={isRunning}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Abandonment Recovery
              </Button>
              <Button 
                onClick={() => runSingleScenario('edge-cases')} 
                disabled={isRunning}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Edge Cases
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Comprehensive Testing</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={runAllScenarios} 
                disabled={isRunning}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Run All Scenarios
              </Button>
              {isRunning && (
                <div className="mt-3">
                  <div className="text-sm text-muted-foreground mb-2">
                    Running: {currentTest}
                  </div>
                  <Progress value={33} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Test Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Success Rate</span>
                  <span className="font-medium">{testMetrics.overallSuccessRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Scenarios Passed</span>
                  <span className="font-medium">{testMetrics.passedScenarios}/{testMetrics.totalScenarios}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Avg Time</span>
                  <span className="font-medium">{testMetrics.averageExecutionTime.toFixed(1)}s</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant={testMetrics.overallSuccessRate > 90 ? "default" : "destructive"} className="w-full justify-center">
                  {testMetrics.overallSuccessRate > 90 ? "Healthy" : "Needs Attention"}
                </Badge>
                <div className="text-xs text-muted-foreground text-center">
                  Last run: {testResults.length > 0 ? 'Recently' : 'Never'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <div className="space-y-6">
          {testResults.map((result, index) => (
            <Card key={`${result.scenario}-${index}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(getScenarioStatus(result))}
                    <CardTitle className="text-lg">{result.scenario.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
                  </div>
                  <div className="flex space-x-2">
                    <Badge variant={getScenarioStatus(result) === 'success' ? "default" : "destructive"}>
                      {result.summary.passed}/{result.summary.total} passed
                    </Badge>
                    <Badge variant="outline">
                      {result.summary.executionTime.toFixed(1)}s
                    </Badge>
                  </div>
                </div>
                <CardDescription>{result.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {result.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                        {getStatusIcon(step.status)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{step.step}</div>
                          <div className="text-xs text-muted-foreground mt-1">{step.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>

        {testResults.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground">
                No test results yet. Run a scenario to see detailed results.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}