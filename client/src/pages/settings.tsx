import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Mail, Key, Globe, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

const fetchSettings = async () => {
  const res = await fetch("/api/bulk-email/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
};

export default function SettingsPage() {
  const [emailConfig, setEmailConfig] = useState({
    apiKey: "",
    domain: "",
  });
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const handleSaveEmailConfig = async () => {
    // In a real app, this would save to the backend
    toast({
      title: "Settings saved",
      description: "Email service configuration has been updated",
    });
  };

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your CCL system settings</p>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList>
          <TabsTrigger value="email">Email Service</TabsTrigger>
          <TabsTrigger value="api">API Configuration</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mailgun Configuration</CardTitle>
                  <CardDescription>Configure your email service provider</CardDescription>
                </div>
                <Badge variant={settings?.data?.mailgun?.configured ? "default" : "secondary"}>
                  {settings?.data?.mailgun?.configured ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Connected
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Not Configured
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings?.data?.mailgun?.configured ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Mailgun is configured and ready to send emails. Domain:{" "}
                    <strong>{settings.data.mailgun.domain}</strong>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Mailgun is not configured. Add MAILGUN_API_KEY and MAILGUN_DOMAIN to your
                    environment variables.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="mailgun-domain">Mailgun Domain</Label>
                <Input
                  id="mailgun-domain"
                  value={settings?.data?.mailgun?.domain || "Not configured"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  This value is set via environment variables
                </p>
              </div>

              <div className="space-y-2">
                <Label>Email Sending Status</Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${settings?.data?.mailgun?.configured ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span className="text-sm">
                    {settings?.data?.mailgun?.configured
                      ? "Ready to send emails"
                      : "Cannot send emails"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Configuration Instructions</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Sign up for a Mailgun account at mailgun.com</li>
                  <li>Add your domain and verify it</li>
                  <li>Get your API key from the Mailgun dashboard</li>
                  <li>
                    Add these to your Render environment variables:
                    <ul className="ml-6 mt-1 list-disc">
                      <li>MAILGUN_API_KEY</li>
                      <li>MAILGUN_DOMAIN</li>
                    </ul>
                  </li>
                  <li>Redeploy your application</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Timing Settings</CardTitle>
              <CardDescription>Configure delays between email steps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Step 1 Delay</Label>
                  <div className="text-2xl font-bold">
                    {settings?.data?.timing?.step1Delay || 24} hours
                  </div>
                  <p className="text-xs text-muted-foreground">After initial trigger</p>
                </div>
                <div>
                  <Label>Step 2 Delay</Label>
                  <div className="text-2xl font-bold">
                    {settings?.data?.timing?.step2Delay || 72} hours
                  </div>
                  <p className="text-xs text-muted-foreground">After Step 1</p>
                </div>
                <div>
                  <Label>Step 3 Delay</Label>
                  <div className="text-2xl font-bold">
                    {settings?.data?.timing?.step3Delay || 168} hours
                  </div>
                  <p className="text-xs text-muted-foreground">After Step 2</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenRouter Configuration</CardTitle>
              <CardDescription>AI service for generating email content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">OpenRouter API</p>
                      <p className="text-sm text-muted-foreground">
                        {settings?.data?.openrouter?.configured ? "Configured" : "Not configured"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={settings?.data?.openrouter?.configured ? "default" : "secondary"}>
                    {settings?.data?.openrouter?.status || "not_configured"}
                  </Badge>
                </div>

                {!settings?.data?.openrouter?.configured && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Add OPENROUTER_API_KEY to your environment variables to enable AI features.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>System API keys for authentication</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded">
                  <span className="text-sm font-medium">CCL_API_KEY</span>
                  <Badge>Configured</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <span className="text-sm font-medium">INTERNAL_API_KEY</span>
                  <Badge>Configured</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
              <CardDescription>PostgreSQL database connection status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">PostgreSQL Database</p>
                      <p className="text-sm text-muted-foreground">Render PostgreSQL</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Check logs for status</Badge>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Database connection status can be verified in the Render logs. The system will
                    use in-memory storage if database is unavailable.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
