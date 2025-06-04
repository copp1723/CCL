
import React from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { MetricsGrid } from '@/components/metrics-grid';
import { ActivityFeed } from '@/components/activity-feed';
import { LeadsTable } from '@/components/leads-table';
import { EmailCampaigns } from '@/components/email-campaigns';
import { AgentStatusPanel } from '@/components/agent-status-panel';

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      
      <ErrorBoundary>
        <MetricsGrid />
      </ErrorBoundary>

      <div className="grid gap-8 lg:grid-cols-2">
        <ErrorBoundary>
          <ActivityFeed />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <AgentStatusPanel />
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <LeadsTable />
      </ErrorBoundary>

      <ErrorBoundary>
        <EmailCampaigns />
      </ErrorBoundary>
    </div>
  );
}
