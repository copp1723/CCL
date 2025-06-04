import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: number;
  agentName: string;
  action: string;
  details: string;
  status: string;
  createdAt: string;
}

interface ActivityFeedProps {
  activities?: Activity[];
  isLoading: boolean;
}

function getActivityIcon(action: string): React.ReactNode {
  const iconClass = "w-2 h-2 rounded-full mt-2 flex-shrink-0";
  
  switch (action) {
    case 'lead_qualified':
    case 'approved_event_emitted':
    case 'lead_submitted':
      return <div className={`${iconClass} bg-green-500`}></div>;
    case 'email_sent':
    case 'email_opened':
      return <div className={`${iconClass} bg-blue-600`}></div>;
    case 'chat_session_started':
    case 'handoff_to_credit_check':
      return <div className={`${iconClass} bg-amber-500`}></div>;
    case 'abandonment_detected':
      return <div className={`${iconClass} bg-green-500`}></div>;
    case 'lead_submission_failed':
    case 'credit_check_error':
      return <div className={`${iconClass} bg-red-500`}></div>;
    default:
      return <div className={`${iconClass} bg-gray-400`}></div>;
  }
}

function formatActivityMessage(activity: Activity): { title: string; description: string } {
  switch (activity.action) {
    case 'abandonment_detected':
      return {
        title: 'Abandonment detected',
        description: activity.details || 'Visitor left application',
      };
    case 'email_sent':
      return {
        title: 'Email sent',
        description: activity.details || 'Re-engagement email sent',
      };
    case 'email_opened':
      return {
        title: 'Email opened',
        description: activity.details || 'Re-engagement email opened',
      };
    case 'chat_session_started':
      return {
        title: 'Chat session started',
        description: activity.details || 'New visitor chat session',
      };
    case 'credit_check_completed':
      return {
        title: 'Credit check completed',
        description: activity.details || 'Credit assessment finished',
      };
    case 'lead_submitted':
      return {
        title: 'Lead submitted',
        description: activity.details || 'Lead sent to dealer CRM',
      };
    case 'lead_submission_failed':
      return {
        title: 'Lead submission failed',
        description: activity.details || 'Dealer CRM submission failed',
      };
    default:
      return {
        title: activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: activity.details || 'Agent action completed',
      };
  }
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Live Activity</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Recent agent actions</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton className="w-2 h-2 rounded-full mt-2 flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Live Activity</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Recent agent actions</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <p>No recent activity</p>
            <p className="text-xs mt-1">Agent actions will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900">Live Activity</CardTitle>
        <p className="text-sm text-gray-600 mt-1">Recent agent actions</p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {activities.map((activity) => {
            const { title, description } = formatActivityMessage(activity);
            
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                {getActivityIcon(activity.action)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 font-medium">{title}</p>
                  <p className="text-xs text-gray-500">{description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
