import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle, 
  Clock,
  Users,
  Mail,
  Activity
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

interface ActivityItem {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  agentType?: string;
  metadata?: any;
}

interface Lead {
  id: string;
  status: string;
  createdAt: string;
  email: string;
}

interface Metrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

export default function Dashboard() {
  const { data: agentsResponse } = useQuery({
    queryKey: ['/api/agents/status'],
    refetchInterval: 30000,
  });

  const { data: metricsResponse } = useQuery({
    queryKey: ['/api/metrics'],
    refetchInterval: 30000,
  });

  const { data: activitiesResponse } = useQuery({
    queryKey: ['/api/activity'],
    refetchInterval: 10000,
  });

  const { data: leadsResponse } = useQuery({
    queryKey: ['/api/leads'],
    refetchInterval: 30000,
  });

  // Extract data from standardized API responses
  const agents = agentsResponse?.data || [];
  const metrics = metricsResponse?.data;
  const activities = activitiesResponse?.data || [];
  const leads = leadsResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor AI agents processing auto loan leads and email automation
          </p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="mr-1 h-3 w-3" />
          All Systems Operational
        </Badge>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeAgents || 5}</div>
            <p className="text-xs text-muted-foreground">AI agents processing leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.leadsGenerated || 0}</div>
            <p className="text-xs text-muted-foreground">Total processed today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.emailDeliveryRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Mailgun delivery success</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgResponseTime || 0}s</div>
            <p className="text-xs text-muted-foreground">Average agent response</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent Status */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Status</CardTitle>
            <CardDescription>Real-time status of AI agents processing leads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Activity className={`h-5 w-5 ${agent.status === 'active' ? 'text-green-600' : 'text-gray-600'}`} />
                    <div>
                      <p className="text-sm font-medium">{agent.name.replace('Agent', '')}</p>
                      <p className="text-xs text-muted-foreground">{agent.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={agent.status === 'active' ? 'text-green-600' : 'text-gray-600'}>
                      {agent.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {agent.processedToday} today
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Live feed of agent actions and lead processing</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {Array.isArray(activities) ? activities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {(activity.agentType || 'System').replace('Agent', '')}: {activity.description}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-muted-foreground py-4">
                    No recent activity
                  </div>
                )}
                {activities.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    No recent activity
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Latest customer leads processed by the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leads.slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <p className="text-sm font-medium">{lead.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">{lead.status}</Badge>
              </div>
            ))}
            {leads.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No leads processed yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}