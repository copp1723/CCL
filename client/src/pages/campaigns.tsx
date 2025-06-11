import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Play, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// API fetcher functions
const fetchCampaigns = async () => {
  const res = await fetch("/api/campaigns");
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

const createCampaign = async (data: any) => {
  const res = await fetch("/api/campaigns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("Failed to create campaign");
  }
  return res.json();
};

const startCampaign = async (campaignId: string) => {
  const res = await fetch(`/api/campaigns/${campaignId}/start`, {
    method: "PUT",
  });
  if (!res.ok) {
    throw new Error("Failed to start campaign");
  }
  return res.json();
};

// Zod schema for the form
const campaignSchema = z.object({
  name: z.string().min(3, "Campaign name must be at least 3 characters."),
  goal_prompt: z.string().min(10, "AI goal prompt must be at least 10 characters."),
});

function CreateCampaignForm({ setOpen }: { setOpen: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: "", goal_prompt: "" },
  });

  const mutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setOpen(false);
    },
  });

  function onSubmit(values: z.infer<typeof campaignSchema>) {
    mutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Q3 New Leads Follow-up" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="goal_prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AI Goal Prompt</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Get a confirmed phone number for a soft credit pull."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Campaign"}
        </Button>
      </form>
    </Form>
  );
}

export default function CampaignsPage() {
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: campaigns,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  });

  const startCampaignMutation = useMutation({
    mutationFn: startCampaign,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Success",
        description: data.message || "Campaign started successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start campaign",
        variant: "destructive",
      });
    },
  });

  const handleStartCampaign = (campaignId: string) => {
    startCampaignMutation.mutate(campaignId);
  };

  if (isLoading) return <div>Loading campaigns...</div>;
  if (error) return <div>Error loading campaigns.</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Email Campaigns</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Campaign</DialogTitle>
            </DialogHeader>
            <CreateCampaignForm setOpen={setOpen} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns?.map((campaign: any) => (
          <Card key={campaign.id}>
            <CardHeader>
              <CardTitle>{campaign.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{campaign.goal_prompt}</p>
              <div className="mt-4">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    campaign.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {campaign.status}
                </span>
              </div>
              {campaign.status !== "active" && (
                <Button
                  className="mt-4 w-full"
                  onClick={() => handleStartCampaign(campaign.id)}
                  disabled={startCampaignMutation.isPending}
                  variant="default"
                >
                  {startCampaignMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Campaign
                    </>
                  )}
                </Button>
              )}
              {campaign.status === "active" && (
                <div className="mt-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                  Campaign is currently running
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
