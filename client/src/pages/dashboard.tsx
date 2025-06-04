import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { MetricsGrid } from '@/components/metrics-grid';
import { AgentStatusPanel } from '@/components/agent-status-panel';
import { ActivityFeed } from '@/components/activity-feed';
import { LeadsTable } from '@/components/leads-table';
import { ChatWidget } from '@/components/chat-widget';
import { useQuery } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
// Type definitions
interface Metrics {
  activeAgents: number;
  leadsGenerated: number;
  emailDeliveryRate: number;
  avgResponseTime: number;
}

interface AgentStatus {
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: Date;
  processedToday: number;
  description: string;
  icon: string;
  color: string;
}

interface Activity {
  id: number;
  agentName: string;
  action: string;
  status: string;
  details: string | null;
  createdAt: Date;
  visitorId: number | null;
  leadId: number | null;
}

interface Lead {
  id: number;
  visitorId: number;
  creditCheckId: number | null;
  leadData: {
    leadId: string;
    visitor: {
      emailHash: string;
    };
    creditAssessment: {
      approved: boolean;
      score?: number;
    };
    metadata: {
      priority: 'high' | 'medium' | 'low';
    };
  };
  status: string;
  dealerResponse: unknown;
  submittedAt: Date | null;
  createdAt: Date;
}

interface User {
  name: string;
  role: string;
  initials: string;
}

export default function Dashboard() {
  const [user] = useState<User>({
    name: 'Sarah Johnson',
    role: 'Operations Manager',
    initials: 'SJ',
  });

  const { toast } = useToast();

  const { data: metrics, isLoading: metricsLoading } = useQuery<Metrics>({
    queryKey: ['/api/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: agentStatuses, isLoading: statusLoading } = useQuery<AgentStatus[]>({
    queryKey: ['/api/agents/status'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['/api/activity'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Show toast for new successful leads
  useEffect(() => {
    if (leads && leads.length > 0) {
      const recentLead = leads[0];
      const leadAge = Date.now() - new Date(recentLead.createdAt).getTime();
      
      // If lead is less than 2 minutes old, show toast
      if (leadAge < 2 * 60 * 1000 && recentLead.status === 'submitted') {
        toast({
          title: "New lead qualified!",
          description: `Lead ${recentLead.id} successfully submitted to dealer CRM`,
          duration: 5000,
        });
      }
    }
  }, [leads, toast]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Agent Dashboard</h1>
              <p className="text-sm text-gray-600">Monitor and manage your AI agents in real-time</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fas fa-bell text-lg"></i>
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{user.initials}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Metrics Grid */}
          <MetricsGrid metrics={metrics} isLoading={metricsLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Agent Status Panel */}
            <div className="lg:col-span-2">
              <AgentStatusPanel 
                agentStatuses={agentStatuses} 
                isLoading={statusLoading} 
              />
            </div>

            {/* Activity Feed */}
            <div>
              <ActivityFeed 
                activities={activities} 
                isLoading={activitiesLoading} 
              />
            </div>
          </div>

          {/* Leads Table */}
          <div className="mt-8">
            <LeadsTable 
              leads={leads} 
              isLoading={leadsLoading} 
            />
          </div>
        </main>
      </div>

      {/* Chat Widget */}
      {/* <ChatWidget /> */}
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
