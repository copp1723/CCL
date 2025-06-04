import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Users,
  Mail,
  CreditCard,
  Package,
  MessageCircle,
  Activity
} from "lucide-react";

interface AgentStatus {
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

export default function Dashboard() {
  const { toast } = useToast();

  const { data: agentStatuses = [] } = useQuery({
    queryKey: ['/api/agents/status'],
    refetchInterval: 30000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['/api/metrics'],
    refetchInterval: 30000,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['/api/activity'],
    refetchInterval: 10000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['/api/leads'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (activities && activities.length > 0) {
      const recentErrors = activities.filter((a: ActivityItem) => 
        a.type === 'error' && 
        new Date(a.timestamp || new Date()).getTime() > Date.now() - 60000
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

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, any> = {
      Users,
      MessageCircle,
      Mail,
      CreditCard,
      Package
    };
    return iconMap[iconName] || Activity;
  };

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
        <Card>
          <CardHeader>
            <CardTitle>Agent Status</CardTitle>
            <CardDescription>Real-time status of AI agents processing leads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentStatuses.map((agent: AgentStatus) => {
                const IconComponent = getIconComponent(agent.icon);
                const statusColor = agent.status === 'active' ? 'text-green-600' : 
                                  agent.status === 'error' ? 'text-red-600' : 'text-gray-600';
                
                return (
                  <div key={agent.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <IconComponent className={`h-5 w-5 ${statusColor}`} />
                      <div>
                        <p className="text-sm font-medium">{agent.name.replace('Agent', '')}</p>
                        <p className="text-xs text-muted-foreground">{agent.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={statusColor}>
                        {agent.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {agent.processedToday} today
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Live feed of agent actions and lead processing</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {activities.slice(0, 10).map((activity: ActivityItem) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-2 text-sm">
                    {activity.type === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {(activity.agentType || 'System').replace('Agent', '')}: {activity.description}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(activity.timestamp || Date.now()).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {(!activities || activities.length === 0) && (
                  <div className="text-center text-muted-foreground py-4">
                    No recent activity
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Latest customer leads processed by the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leads.slice(0, 5).map((lead: Lead) => (
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
            {(!leads || leads.length === 0) && (
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