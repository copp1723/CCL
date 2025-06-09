import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown } from "lucide-react";

interface AgentStatus {
  name: string;
  status: "active" | "inactive" | "error";
  lastActivity: string;
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

interface AgentStatusPanelProps {
  agentStatuses?: AgentStatus[];
  isLoading: boolean;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "inactive":
      return "bg-gray-400";
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
}

function getAgentIcon(iconName: string): React.ReactNode {
  const iconClass = "text-white text-lg";
  switch (iconName) {
    case "fas fa-search":
      return <i className={`fas fa-search ${iconClass}`} />;
    case "fas fa-envelope":
      return <i className={`fas fa-envelope ${iconClass}`} />;
    case "fas fa-comments":
      return <i className={`fas fa-comments ${iconClass}`} />;
    case "fas fa-shield-alt":
      return <i className={`fas fa-shield-alt ${iconClass}`} />;
    case "fas fa-box":
      return <i className={`fas fa-box ${iconClass}`} />;
    default:
      return <i className={`fas fa-robot ${iconClass}`} />;
  }
}

function getAgentColorClass(color: string): string {
  switch (color) {
    case "accent":
      return "bg-green-500";
    case "primary":
      return "bg-blue-600";
    case "warning":
      return "bg-amber-500";
    default:
      return "bg-blue-600";
  }
}

export function AgentStatusPanel({ agentStatuses, isLoading }: AgentStatusPanelProps) {
  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Agent Pipeline Status
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Real-time monitoring of your AI agent workflow
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i}>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                {i < 4 && (
                  <div className="flex items-center justify-center py-2">
                    <ArrowDown className="h-4 w-4 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!agentStatuses || agentStatuses.length === 0) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Agent Pipeline Status
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Real-time monitoring of your AI agent workflow
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <p>No agent status data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900">Agent Pipeline Status</CardTitle>
        <p className="text-sm text-gray-600 mt-1">Real-time monitoring of your AI agent workflow</p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {agentStatuses.map((agent, index) => (
            <div key={agent.name}>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-shrink-0">
                  <div
                    className={`w-12 h-12 ${getAgentColorClass(agent.color)} rounded-lg flex items-center justify-center`}
                  >
                    {getAgentIcon(agent.icon)}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900">{agent.name}</h4>
                  <p className="text-xs text-gray-600">{agent.description}</p>
                  <div className="mt-2 flex items-center space-x-4">
                    <Badge variant={getStatusBadgeVariant(agent.status)} className="capitalize">
                      {agent.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {agent.processedToday} processed today
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 ${getStatusColor(agent.status)} rounded-full ${
                      agent.status === "active" ? "animate-pulse" : ""
                    }`}
                  ></div>
                  <span className="text-xs text-gray-500 capitalize">{agent.status}</span>
                </div>
              </div>

              {index < agentStatuses.length - 1 && (
                <div className="flex items-center justify-center py-2">
                  <ArrowDown className="h-4 w-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
