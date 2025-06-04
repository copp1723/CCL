import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, MessageCircle, CreditCard, Package, ChevronDown } from "lucide-react";

export function AgentStatusPanel() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ["/api/agents"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const agentIcons = {
    visitor_identifier: Search,
    email_reengagement: Mail, 
    realtime_chat: MessageCircle,
    credit_check: CreditCard,
    lead_packaging: Package,
  };

  const agentColors = {
    visitor_identifier: "emerald",
    email_reengagement: "blue",
    realtime_chat: "amber", 
    credit_check: "purple",
    lead_packaging: "orange",
  };

  const colorClasses = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    purple: "bg-purple-500", 
    orange: "bg-orange-500",
  };

  return (
    <div className="lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>Agent Pipeline Status</CardTitle>
          <p className="text-sm text-gray-600">Real-time monitoring of your AI agent workflow</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {agents?.map((agent: any, index: number) => {
              const Icon = agentIcons[agent.type as keyof typeof agentIcons] || Search;
              const colorClass = colorClasses[agentColors[agent.type as keyof typeof agentColors] as keyof typeof colorClasses];
              
              return (
                <div key={agent.id}>
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 ${colorClass} rounded-lg flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">{agent.name}</h4>
                      <p className="text-xs text-gray-600">
                        {agent.type === 'visitor_identifier' && 'Detecting abandonment events via SQS'}
                        {agent.type === 'email_reengagement' && 'Sending personalized emails via SendGrid'}
                        {agent.type === 'realtime_chat' && 'WebSocket chat with <1s latency'}
                        {agent.type === 'credit_check' && 'FlexPath API credit verification'}
                        {agent.type === 'lead_packaging' && 'Assembling and submitting qualified leads'}
                      </p>
                      <div className="mt-2 flex items-center space-x-4">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          {agent.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {agent.eventsProcessed} events processed
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-gray-500">Running</span>
                    </div>
                  </div>
                  
                  {index < (agents?.length || 0) - 1 && (
                    <div className="flex items-center justify-center py-2">
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
