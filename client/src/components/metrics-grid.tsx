import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Bot, Users, Mail, Clock } from "lucide-react";

interface Metrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

interface MetricsGridProps {
  metrics?: Metrics;
  isLoading: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  isLoading: boolean;
}

function MetricCard({ title, value, icon, trend, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-opacity-10">
            {icon}
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center">
            <span
              className={`text-sm flex items-center ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-sm text-gray-500 ml-2">{trend.period}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsGrid({ metrics, isLoading }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Active Agents"
        value={metrics?.activeAgents ?? 0}
        icon={<Bot className="h-6 w-6 text-green-600" />}
        trend={{
          value: 8.5,
          isPositive: true,
          period: "vs last week",
        }}
        isLoading={isLoading}
      />

      <MetricCard
        title="Leads Generated"
        value={metrics?.leadsGenerated ?? 0}
        icon={<Users className="h-6 w-6 text-blue-600" />}
        trend={{
          value: 12.3,
          isPositive: true,
          period: "vs yesterday",
        }}
        isLoading={isLoading}
      />

      <MetricCard
        title="Email Delivery Rate"
        value={metrics?.emailDeliveryRate ? `${metrics.emailDeliveryRate}%` : "0%"}
        icon={<Mail className="h-6 w-6 text-amber-600" />}
        trend={{
          value: 2.1,
          isPositive: true,
          period: "vs last month",
        }}
        isLoading={isLoading}
      />

      <MetricCard
        title="Avg Response Time"
        value={metrics?.avgResponseTime ? `${metrics.avgResponseTime}s` : "0s"}
        icon={<Clock className="h-6 w-6 text-red-500" />}
        trend={{
          value: 15.2,
          isPositive: true,
          period: "faster than target",
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
