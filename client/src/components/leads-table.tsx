import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Download } from "lucide-react";

interface Lead {
  id: number;
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
      priority: "high" | "medium" | "low";
    };
  };
  status: string;
  createdAt: string;
}

interface LeadsTableProps {
  leads?: Lead[];
  isLoading: boolean;
}

function getStatusBadge(status: string): React.ReactNode {
  switch (status) {
    case "submitted":
      return <Badge className="bg-blue-600 text-white">Submitted</Badge>;
    case "pending":
      return (
        <Badge variant="secondary" className="bg-amber-500 text-white">
          Processing
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getCreditStatusBadge(approved: boolean): React.ReactNode {
  return approved ? (
    <Badge className="bg-green-500 text-white">Approved</Badge>
  ) : (
    <Badge className="bg-amber-500 text-white">Pending</Badge>
  );
}

function getPriorityBadge(priority: string): React.ReactNode {
  switch (priority) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-500 text-white">Medium</Badge>;
    case "low":
      return <Badge variant="secondary">Low</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function formatEmailHash(emailHash: string): string {
  // Show first 8 characters of hash for reference
  return `${emailHash.substring(0, 8)}...`;
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function LeadsTable({ leads, isLoading }: LeadsTableProps) {
  const handleExportLeads = () => {
    // In a real application, this would trigger a download
    console.log("Exporting leads...");
  };

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">Recent Leads</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Latest qualified leads from agent workflow</p>
          </div>
          <Button onClick={handleExportLeads} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="h-4 w-4 mr-2" />
            Export Leads
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : !leads || leads.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No leads found</p>
            <p className="text-xs mt-1">Qualified leads will appear here</p>
          </div>
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
                    Priority
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
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">
                      {lead.leadData.leadId}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">
                      <div>
                        <p className="font-medium">Lead #{lead.id}</p>
                        <p className="text-gray-500 text-xs">
                          {formatEmailHash(lead.leadData.visitor.emailHash)}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getCreditStatusBadge(lead.leadData.creditAssessment.approved)}
                      {lead.leadData.creditAssessment.score && (
                        <p className="text-xs text-gray-500 mt-1">
                          Score: {lead.leadData.creditAssessment.score}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {getPriorityBadge(lead.leadData.metadata.priority)}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(lead.status)}</td>
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
  );
}
