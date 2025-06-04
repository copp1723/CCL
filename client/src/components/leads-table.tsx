import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export function LeadsTable() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["/api/leads"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-emerald-100 text-emerald-800';
      case 'processing':
        return 'bg-amber-100 text-amber-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCreditStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Leads</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Latest qualified leads from agent workflow</p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Export Leads
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {leads?.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No leads found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Lead ID
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Contact
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Credit Status
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Source
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leads?.map((lead: any) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 text-sm font-medium text-gray-900">
                        #LD-{lead.id.toString().padStart(4, '0')}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">
                        <div>
                          <p className="font-medium">Visitor #{lead.visitorId}</p>
                          <p className="text-gray-500">
                            {lead.contactInfo?.phone || 'Phone not provided'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getCreditStatusColor(lead.creditStatus)}>
                          {lead.creditStatus}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {lead.source.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getStatusColor(lead.status)}>
                          {lead.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
