import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { ChatWidget } from '@/components/chat-widget';
import { AgentConfigEditor } from '@/components/agent-config-editor';
import { Users, Mail, CheckCircle, AlertCircle, Clock, Download, Settings } from 'lucide-react';

// Type definitions for internal use
interface Metrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

interface AgentStatus {
  name: string;
  status: 'active' | 'inactive' | 'error';
  processedToday: number;
}

interface Activity {
  id: number;
  agentName: string;
  action: string;
  status: string;
  details: string | null;
  createdAt: string;
}

interface Lead {
  id: number;
  status: string;
  createdAt: string;
}

export default function Dashboard() {
  const { toast } = useToast();

  const { data: metrics } = useQuery<Metrics>({
    queryKey: ['/api/metrics'],
    refetchInterval: 30000,
  });

  const { data: agentStatuses } = useQuery<AgentStatus[]>({
    queryKey: ['/api/agents/status'],
    refetchInterval: 15000,
  });

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ['/api/activity'],
    refetchInterval: 10000,
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    refetchInterval: 30000,
  });

  // Show error notifications
  useEffect(() => {
    if (activities && activities.length > 0) {
      const recentErrors = activities.filter(a => 
        a.status === 'error' && 
        new Date(a.createdAt).getTime() > Date.now() - 60000 // Last minute
      );
      
      if (recentErrors.length > 0) {
        toast({
          title: 'System Alert',
          description: `${recentErrors.length} agent error(s) detected`,
          variant: 'destructive',
        });
      }
    }
  }, [activities, toast]);

  const exportLeads = async () => {
    try {
      const response = await fetch('/api/leads/export?format=csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export leads data',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">CCL Agent Monitor</h1>
          <p className="text-gray-600">Internal operations dashboard</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Agents</p>
                  <p className="text-2xl font-semibold">{metrics?.activeAgents || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Leads Today</p>
                  <p className="text-2xl font-semibold">{metrics?.leadsGenerated || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Email Rate</p>
                  <p className="text-2xl font-semibold">{metrics?.emailDeliveryRate?.toFixed(1) || 0}%</p>
                </div>
                <Mail className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Response Time</p>
                  <p className="text-2xl font-semibold">{metrics?.avgResponseTime?.toFixed(1) || 0}s</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Agent Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agentStatuses?.map((agent) => (
                  <div key={agent.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`h-3 w-3 rounded-full ${
                        agent.status === 'active' ? 'bg-green-500' : 
                        agent.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <span className="font-medium">{agent.name.replace('Agent', '')}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{agent.processedToday}</div>
                      <div className="text-xs text-gray-500">processed</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <Button onClick={exportLeads} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {activities?.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3 p-2 text-sm">
                      {activity.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {activity.agentName.replace('Agent', '')}: {activity.action}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(activity.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!activities || activities.length === 0) && (
                    <div className="text-center text-gray-500 py-8">
                      No recent activity
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

        </div>

        {/* Lead Summary */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Lead Summary</CardTitle>
              <Badge variant="secondary">
                {leads?.length || 0} total leads
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-semibold text-green-700">
                  {leads?.filter(l => l.status === 'submitted').length || 0}
                </div>
                <div className="text-sm text-green-600">Submitted</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-semibold text-yellow-700">
                  {leads?.filter(l => l.status === 'pending').length || 0}
                </div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-semibold text-blue-700">
                  {leads?.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length || 0}
                </div>
                <div className="text-sm text-blue-600">Today</div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Agent Configuration Section */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent Configuration
          </h2>
          <p className="text-gray-600">Customize agent instructions and personality to align outputs with your needs</p>
        </div>
        
        <AgentConfigEditor />
      </div>

      <ChatWidget />
      <Toaster />
    </div>
  );
}