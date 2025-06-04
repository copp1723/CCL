import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export function ActivityFeed() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/activities"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'lead_qualified':
      case 'credit_approved':
      case 'lead_submitted':
        return 'bg-emerald-500';
      case 'email_sent':
      case 'email_reengagement':
        return 'bg-blue-600';
      case 'chat_session_started':
      case 'chat_message_processed':
        return 'bg-amber-500';
      case 'abandonment_detected':
        return 'bg-purple-500';
      case 'lead_submission_failed':
      case 'credit_declined':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getActivityTitle = (activity: any) => {
    switch (activity.type) {
      case 'lead_qualified':
        return 'Lead qualified';
      case 'email_sent':
        return 'Email sent';
      case 'chat_session_started':
        return 'Chat session started';
      case 'abandonment_detected':
        return 'Abandonment detected';
      case 'lead_submission_failed':
        return 'Lead submission failed';
      case 'credit_approved':
        return 'Credit approved';
      case 'credit_declined':
        return 'Credit declined';
      case 'lead_submitted':
        return 'Lead submitted';
      default:
        return activity.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Activity</CardTitle>
        <p className="text-sm text-gray-600">Recent agent actions</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities?.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No recent activities</p>
          ) : (
            activities?.map((activity: any) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full mt-2 flex-shrink-0`}></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 font-medium">
                    {getActivityTitle(activity)}
                  </p>
                  <p className="text-xs text-gray-500">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
