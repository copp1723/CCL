import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Users, Mail, Clock, TrendingUp, TrendingDown } from "lucide-react";

interface MetricData {
  name: string;
  value: string;
  type: string;
}

export function MetricsGrid() {
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = metricsData?.metrics || {};

  const metricCards = [
    {
      title: "Active Agents",
      value: metrics.activeAgents?.value || "5",
      icon: Bot,
      color: "emerald",
      change: "+8.5%",
      changeType: "increase",
    },
    {
      title: "Leads Generated", 
      value: metrics.leadsGenerated?.value || "247",
      icon: Users,
      color: "blue",
      change: "+12.3%",
      changeType: "increase",
    },
    {
      title: "Email Delivery Rate",
      value: `${metrics.emailDeliveryRate?.value || "97.2"}%`,
      icon: Mail,
      color: "amber",
      change: "+2.1%",
      changeType: "increase",
    },
    {
      title: "Avg Response Time",
      value: `${metrics.avgResponseTime?.value || "0.8"}s`,
      icon: Clock,
      color: "red",
      change: "-15.2%",
      changeType: "decrease",
    },
  ];

  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600", 
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricCards.map((metric) => {
        const Icon = metric.icon;
        const TrendIcon = metric.changeType === "increase" ? TrendingUp : TrendingDown;
        
        return (
          <Card key={metric.title} className="border border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[metric.color as keyof typeof colorClasses]}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className={`text-sm flex items-center ${metric.changeType === "increase" ? "text-emerald-600" : "text-red-600"}`}>
                  <TrendIcon className="h-3 w-3 mr-1" />
                  {metric.change}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  vs {metric.changeType === "decrease" ? "target" : "last week"}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
