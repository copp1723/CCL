import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Mail, Clock, ArrowLeft, Check, Trash2, Pause, Play, Edit2, FilePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// API fetchers
const fetchCampaignById = async (id: string) => {
  const res = await fetch(`/api/campaigns/${id}`);
  if (!res.ok) throw new Error('Failed to fetch campaign');
  return res.json();
};

const fetchTemplatesForCampaign = async (id: string) => {
  const res = await fetch(`/api/campaigns/${id}/templates`);
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
};

const addEmailTemplate = async ({ campaignId, data }: { campaignId: string, data: any }) => {
  const res = await fetch(`/api/campaigns/${campaignId}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add template');
  return res.json();
};

const fetchAllLeads = async (campaignId: string) => {
  const res = await fetch(`/api/campaigns/${campaignId}/leads/all`);
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json();
};

const fetchEnrolledLeads = async (campaignId: string) => {
  const res = await fetch(`/api/campaigns/${campaignId}/leads/enrolled`);
  if (!res.ok) throw new Error('Failed to fetch enrolled leads');
  return res.json();
};

const enrollLeads = async ({ campaignId, leadIds }: { campaignId: string, leadIds: string[] }) => {
  const res = await fetch(`/api/campaigns/${campaignId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadIds }),
  });
  if (!res.ok) throw new Error('Failed to enroll leads');
  return res.json();
};

const updateCampaign = async ({ campaignId, updates }: { campaignId: string, updates: any }) => {
  const res = await fetch(`/api/campaigns/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update campaign');
  return res.json();
};

const deleteCampaign = async (campaignId: string) => {
  const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete campaign');
  return true;
};

const cloneCampaign = async (campaignId: string) => {
  const res = await fetch(`/api/campaigns/${campaignId}/clone`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clone campaign');
  return res.json();
};

// Zod schemas
const templateSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters.'),
  body: z.string().min(10, 'Body must be at least 10 characters.'),
  sequence_order: z.coerce.number().min(1, 'Sequence order must be at least 1.'),
  delay_hours: z.coerce.number().min(1, 'Delay must be at least 1 hour.'),
});

const campaignEditSchema = z.object({
  name: z.string().min(3),
  goal_prompt: z.string().min(10)
});

function AddTemplateForm({ campaignId, setOpen }: { campaignId: string, setOpen: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: { subject: '', body: '', sequence_order: 1, delay_hours: 24 },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => addEmailTemplate({ campaignId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', campaignId] });
      setOpen(false);
    },
  });

  function onSubmit(values: z.infer<typeof templateSchema>) {
    mutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="subject" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="Email Subject" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField name="body" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Body</FormLabel><FormControl><Textarea placeholder="Email content..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField name="sequence_order" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Sequence Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField name="delay_hours" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Delay (hours)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={mutation.isLoading}>{mutation.isLoading ? 'Adding...' : 'Add Template'}</Button>
      </form>
    </Form>
  );
}

function EditCampaignForm({ campaign, setOpen }: { campaign: any, setOpen: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof campaignEditSchema>>({
    resolver: zodResolver(campaignEditSchema),
    defaultValues: { name: campaign.name, goal_prompt: campaign.goal_prompt },
  });

  const mutation = useMutation({
    mutationFn: (updates: z.infer<typeof campaignEditSchema>) => updateCampaign({ campaignId: campaign.id, updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      setOpen(false);
    }
  });

  function onSubmit(values: z.infer<typeof campaignEditSchema>) {
    mutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="name" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField name="goal_prompt" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>AI Goal Prompt</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={mutation.isLoading}>{mutation.isLoading ? 'Saving...' : 'Save Changes'}</Button>
      </form>
    </Form>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id;
  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [cloneLoading, setCloneLoading] = React.useState(false);

  const queryClient = useQueryClient();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => fetchCampaignById(campaignId!),
    enabled: !!campaignId,
  });
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['templates', campaignId],
    queryFn: () => fetchTemplatesForCampaign(campaignId!),
    enabled: !!campaignId,
  });
  const { data: allLeads, isLoading: allLeadsLoading } = useQuery({
    queryKey: ['allLeads', campaignId],
    queryFn: () => fetchAllLeads(campaignId!),
    enabled: !!campaignId,
  });
  const { data: enrolledLeads, isLoading: enrolledLeadsLoading } = useQuery({
    queryKey: ['enrolledLeads', campaignId],
    queryFn: () => fetchEnrolledLeads(campaignId!),
    enabled: !!campaignId,
  });

  // Admin mutations
  const mutationDelete = useMutation({
    mutationFn: () => deleteCampaign(campaignId!),
    onSuccess: () => {
      setConfirmDelete(false);
      window.location.href = '/campaigns';
    }
  });

  const mutationEnroll = useMutation({
    mutationFn: (leadIds: string[]) => enrollLeads({ campaignId: campaignId!, leadIds }),
    onSuccess: () => {
      setEnrollOpen(false);
      queryClient.invalidateQueries({ queryKey: ['enrolledLeads', campaignId] });
    }
  });

  // Pause/Start
  const mutationPauseStart = useMutation({
    mutationFn: (status: string) => updateCampaign({ campaignId: campaignId!, updates: { status } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }); }
  });

  // Clone
  const handleClone = async () => {
    setCloneLoading(true);
    await cloneCampaign(campaignId!);
    setCloneLoading(false);
    window.location.href = '/campaigns';
  };

  // Compute available leads for enrollment
  const enrolledIds = new Set(enrolledLeads?.map((l: any) => l.id));
  const availableLeads = (allLeads || []).filter((l: any) => !enrolledIds.has(l.id));
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<string[]>([]);

  if (campaignLoading || templatesLoading || allLeadsLoading || enrolledLeadsLoading) return <div>Loading...</div>;
  if (campaignError || templatesError) return <div>Error loading campaign details.</div>;
  if (!campaign) return <div>Campaign not found.</div>;

  return (
    <div>
      <Link to="/campaigns">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns
        </Button>
      </Link>

      {/* Admin Actions */}
      <div className="flex gap-2 mb-2">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Edit2 className="mr-2 h-4 w-4" />Edit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Campaign</DialogTitle></DialogHeader>
            <EditCampaignForm campaign={campaign} setOpen={setEditOpen} />
          </DialogContent>
        </Dialog>
        <Button variant="outline" color="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
        <Button variant={campaign.status === 'paused' ? "default" : "outline"} onClick={() => mutationPauseStart.mutate(campaign.status === 'active' ? 'paused' : 'active')}>
          {campaign.status === 'active' ? (<><Pause className="mr-2 h-4 w-4" />Pause</>) : (<><Play className="mr-2 h-4 w-4" />Start</>)}
        </Button>
        <Button variant="outline" onClick={handleClone} disabled={cloneLoading}><FilePlus className="mr-2 h-4 w-4" />{cloneLoading ? 'Cloning...' : 'Clone'}</Button>
      </div>
      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mb-4 bg-red-50 p-4 rounded border border-red-200 text-red-600">
          <p>Are you sure you want to delete this campaign? This action cannot be undone.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="destructive" onClick={() => mutationDelete.mutate()}><Trash2 className="mr-2 h-4 w-4" />Yes, Delete</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">{campaign.goal_prompt}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Email Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a New Email to the Sequence</DialogTitle>
            </DialogHeader>
            <AddTemplateForm campaignId={campaignId!} setOpen={setOpen} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-10 space-y-4">
        <h2 className="text-xl font-semibold">Email Sequence</h2>
        {templates?.length > 0 ? (
          templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="mr-2 h-5 w-5" />
                  Step {template.sequence_order}: {template.subject}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm border-l-2 pl-4 italic">{template.body}</p>
                <div className="mt-4 text-xs text-muted-foreground flex items-center">
                  <Clock className="mr-1 h-3 w-3" />
                  Sent {template.delay_hours} hours after previous step
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p>No email templates yet. Add one to start your campaign sequence!</p>
        )}
      </div>

      <div className="mb-10">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Enrolled Leads</h2>
          <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary"><PlusCircle className="mr-1 h-4 w-4" />Enroll Leads</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Enroll Leads In Campaign</DialogTitle></DialogHeader>
              <div>
                <p>Select leads to enroll in this campaign:</p>
                {availableLeads.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                    {availableLeads.map((l: any) => (
                      <label key={l.id} className="flex items-center gap-2">
                        <input type="checkbox" value={l.id} checked={selectedLeadIds.includes(l.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedLeadIds(ids => [...ids, l.id]);
                            } else {
                              setSelectedLeadIds(ids => ids.filter(id => id !== l.id));
                            }
                          }}
                        />
                        {l.email} ({l.status})
                      </label>
                    ))}
                  </div>
                ) : <div className="py-2">No available leads to enroll.</div>}
                <Button className="mt-2" disabled={selectedLeadIds.length === 0 || mutationEnroll.isLoading}
                  onClick={() => mutationEnroll.mutate(selectedLeadIds)}>
                  {mutationEnroll.isLoading ? 'Enrolling...' : 'Enroll Selected'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full bg-white text-sm">
            <thead>
              <tr>
                <th className="p-2 border-b text-left">Email</th>
                <th className="p-2 border-b">Status</th>
                <th className="p-2 border-b">Step</th>
              </tr>
            </thead>
            <tbody>
              {enrolledLeads?.map((l: any) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-2">{l.email}</td>
                  <td className="p-2 capitalize">{l.campaign_status} {l.campaign_status === 'completed' ? <Check className="inline ml-1 text-green-600" /> : null}</td>
                  <td className="p-2">{l.current_step ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
