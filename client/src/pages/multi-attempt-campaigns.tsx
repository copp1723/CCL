import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Mail, Users, Play, Pause, Settings, Plus, Trash2 } from 'lucide-react';

interface AttemptConfig {
  attemptNumber: number;
  templateId: string;
  delayHours: number;
  delayDays: number;
  conditions?: {
    skipIfResponded?: boolean;
    skipIfOpened?: boolean;
    maxAttempts?: number;
  };
}

interface Schedule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  attempts: AttemptConfig[];
  createdAt: string;
  updatedAt: string;
}

export default function MultiAttemptCampaigns() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    description: '',
    attempts: [{ attemptNumber: 1, templateId: '', delayHours: 0, delayDays: 1 }] as AttemptConfig[]
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active schedules
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/email-campaigns/schedules'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch email templates
  const { data: templatesData } = useQuery({
    queryKey: ['/api/email-campaigns/templates'],
  });

  // Fetch upcoming attempts
  const { data: upcomingData } = useQuery({
    queryKey: ['/api/email-campaigns/schedules/upcoming'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch leads for enrollment
  const { data: leadsData } = useQuery({
    queryKey: ['/api/leads'],
  });

  useEffect(() => {
    if (schedulesData?.success) {
      setSchedules(schedulesData.data);
    }
  }, [schedulesData]);

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      return apiRequest('/api/email-campaigns/schedules', {
        method: 'POST',
        body: JSON.stringify(scheduleData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Schedule Created",
        description: "Multi-attempt campaign schedule created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns/schedules'] });
      setNewSchedule({
        name: '',
        description: '',
        attempts: [{ attemptNumber: 1, templateId: '', delayHours: 0, delayDays: 1 }]
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create schedule",
        variant: "destructive",
      });
    },
  });

  // Toggle schedule mutation
  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ scheduleId, isActive }: { scheduleId: string; isActive: boolean }) => {
      return apiRequest(`/api/email-campaigns/schedules/${scheduleId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns/schedules'] });
      toast({
        title: "Schedule Updated",
        description: "Schedule status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update schedule",
        variant: "destructive",
      });
    },
  });

  // Bulk enroll mutation
  const bulkEnrollMutation = useMutation({
    mutationFn: async ({ scheduleId, leadIds }: { scheduleId: string; leadIds: string[] }) => {
      return apiRequest(`/api/email-campaigns/schedules/${scheduleId}/bulk-enroll`, {
        method: 'POST',
        body: JSON.stringify({ leadIds }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Enrollment Complete",
        description: `${data.data.successCount} leads enrolled successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-campaigns/schedules/upcoming'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enroll leads",
        variant: "destructive",
      });
    },
  });

  const addAttempt = () => {
    const nextNumber = newSchedule.attempts.length + 1;
    setNewSchedule(prev => ({
      ...prev,
      attempts: [
        ...prev.attempts,
        { 
          attemptNumber: nextNumber, 
          templateId: '', 
          delayHours: 0, 
          delayDays: nextNumber 
        }
      ]
    }));
  };

  const removeAttempt = (index: number) => {
    setNewSchedule(prev => ({
      ...prev,
      attempts: prev.attempts.filter((_, i) => i !== index)
    }));
  };

  const updateAttempt = (index: number, field: keyof AttemptConfig, value: any) => {
    setNewSchedule(prev => ({
      ...prev,
      attempts: prev.attempts.map((attempt, i) => 
        i === index ? { ...attempt, [field]: value } : attempt
      )
    }));
  };

  const createSchedule = () => {
    if (!newSchedule.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Schedule name is required",
        variant: "destructive",
      });
      return;
    }

    const invalidAttempts = newSchedule.attempts.filter(a => !a.templateId);
    if (invalidAttempts.length > 0) {
      toast({
        title: "Validation Error",
        description: "All attempts must have a template selected",
        variant: "destructive",
      });
      return;
    }

    createScheduleMutation.mutate(newSchedule);
  };

  const enrollAllLeads = (scheduleId: string) => {
    if (!leadsData?.data?.length) {
      toast({
        title: "No Leads",
        description: "No leads available for enrollment",
        variant: "destructive",
      });
      return;
    }

    const leadIds = leadsData.data.map((lead: any) => lead.id);
    bulkEnrollMutation.mutate({ scheduleId, leadIds });
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Multi-Attempt Email Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage automated email sequences with precise timing controls
          </p>
        </div>
      </div>

      <Tabs defaultValue="schedules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="schedules">Active Schedules</TabsTrigger>
          <TabsTrigger value="create">Create Schedule</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Attempts</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {schedulesLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading schedules...</div>
                </CardContent>
              </Card>
            ) : schedules.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-muted-foreground">
                    No schedules created yet. Create your first multi-attempt campaign.
                  </div>
                </CardContent>
              </Card>
            ) : (
              schedules.map((schedule) => (
                <Card key={schedule.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{schedule.name}</CardTitle>
                      <Badge variant={schedule.isActive ? "default" : "secondary"}>
                        {schedule.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <CardDescription>{schedule.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {schedule.attempts.length} attempts
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {Math.max(...schedule.attempts.map(a => a.delayDays))} days max
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Attempt Schedule:</h4>
                      {schedule.attempts.map((attempt, index) => (
                        <div key={index} className="text-xs bg-muted p-2 rounded">
                          Attempt {attempt.attemptNumber}: {attempt.delayDays}d {attempt.delayHours}h delay
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant={schedule.isActive ? "outline" : "default"}
                        onClick={() => toggleScheduleMutation.mutate({
                          scheduleId: schedule.id,
                          isActive: !schedule.isActive
                        })}
                        disabled={toggleScheduleMutation.isPending}
                      >
                        {schedule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {schedule.isActive ? "Pause" : "Activate"}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enrollAllLeads(schedule.id)}
                        disabled={bulkEnrollMutation.isPending || !schedule.isActive}
                      >
                        <Users className="h-4 w-4" />
                        Enroll All Leads
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Multi-Attempt Schedule</CardTitle>
              <CardDescription>
                Set up an automated email sequence with specific timing for each attempt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Schedule Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekly Re-engagement"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule(prev => ({...prev, name: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of this campaign"
                    value={newSchedule.description}
                    onChange={(e) => setNewSchedule(prev => ({...prev, description: e.target.value}))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Email Attempts</h3>
                  <Button onClick={addAttempt} size="sm">
                    <Plus className="h-4 w-4" />
                    Add Attempt
                  </Button>
                </div>

                {newSchedule.attempts.map((attempt, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Attempt {attempt.attemptNumber}</h4>
                      {newSchedule.attempts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttempt(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Email Template</Label>
                        <Select
                          value={attempt.templateId}
                          onValueChange={(value) => updateAttempt(index, 'templateId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templatesData?.data?.map((template: any) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Delay Days</Label>
                        <Input
                          type="number"
                          min="0"
                          value={attempt.delayDays}
                          onChange={(e) => updateAttempt(index, 'delayDays', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Delay Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={attempt.delayHours}
                          onChange={(e) => updateAttempt(index, 'delayHours', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Button 
                onClick={createSchedule}
                disabled={createScheduleMutation.isPending}
                className="w-full"
              >
                {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Scheduled Attempts</CardTitle>
              <CardDescription>
                Email attempts scheduled for the next 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingData?.data?.attempts?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No email attempts scheduled for the next 24 hours
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingData?.data?.attempts?.map((attempt: any) => (
                    <div key={attempt.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">Attempt {attempt.attemptNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          Lead: {attempt.leadId} | Template: {attempt.templateId}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {new Date(attempt.scheduledFor).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(attempt.scheduledFor).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}