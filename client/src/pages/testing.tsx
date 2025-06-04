import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, XCircle, Clock } from 'lucide-react';

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

export default function Testing() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

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
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const passedTests = testResults.filter(r => r.summary.failed === 0).length;
  const totalTests = testResults.length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">System Testing</h1>
          <p className="text-gray-600">Agent workflow validation</p>
        </div>

        {/* Test Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <Button 
                onClick={() => runSingleScenario('happy-path')} 
                disabled={isRunning}
                className="w-full mb-2"
                size="sm"
              >
                <Play className="h-4 w-4 mr-2" />
                Happy Path
              </Button>
              <div className="text-xs text-gray-500">Full workflow test</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button 
                onClick={() => runSingleScenario('abandonment-recovery')} 
                disabled={isRunning}
                variant="outline"
                className="w-full mb-2"
                size="sm"
              >
                Recovery Test
              </Button>
              <div className="text-xs text-gray-500">Email re-engagement</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button 
                onClick={() => runSingleScenario('edge-cases')} 
                disabled={isRunning}
                variant="outline"
                className="w-full mb-2"
                size="sm"
              >
                Edge Cases
              </Button>
              <div className="text-xs text-gray-500">Error handling</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button 
                onClick={runAllScenarios} 
                disabled={isRunning}
                className="w-full mb-2"
              >
                <Play className="h-4 w-4 mr-2" />
                Run All
              </Button>
              <div className="text-xs text-gray-500">Complete test suite</div>
              {isRunning && (
                <div className="mt-2 text-xs text-blue-600">
                  Running: {currentTest}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Summary */}
        {testResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-green-700">{passedTests}</div>
                <div className="text-sm text-gray-600">Passed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-red-700">{totalTests - passedTests}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-blue-700">
                  {totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <Card key={`${result.scenario}-${index}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      {getStatusIcon(result.summary.failed === 0 ? 'success' : 'failure')}
                      <span>{result.scenario.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </CardTitle>
                    <div className="flex space-x-2">
                      <Badge variant={result.summary.failed === 0 ? "default" : "destructive"}>
                        {result.summary.passed}/{result.summary.total}
                      </Badge>
                      <Badge variant="outline">
                        {result.summary.executionTime.toFixed(1)}s
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {result.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="flex items-center space-x-3 p-2 text-sm border-l-2 border-gray-200">
                          {getStatusIcon(step.status)}
                          <div className="flex-1">
                            <div className="font-medium">{step.step}</div>
                            <div className="text-xs text-gray-500">{step.details}</div>
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

        {testResults.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-gray-500">
                Run tests to see results
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}