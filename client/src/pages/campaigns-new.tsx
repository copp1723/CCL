import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Minimal 3-step wizard skeleton – Phase-2 MVP
export default function CampaignWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const { toast } = useToast();

  const next = () => {
    if (step === 1 && !csvFile) return toast({ title: "Upload CSV first" });
    if (step === 2 && (!subject || !html)) return toast({ title: "Fill template" });
    setStep(prev => (prev + 1) as any);
  };
  const back = () => setStep(prev => (prev - 1) as any);

  const finish = async () => {
    const body = { name: `Campaign ${Date.now()}`, template: { subject, body: html } };
    const res = await fetch("/api/campaigns/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) toast({ title: "Draft created" });
    else toast({ title: "Error", variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">New Campaign</h1>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 – Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Upload CSV</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={e => setCsvFile(e.target.files?.[0] || null)}
            />
            {csvFile && <p className="text-sm">Selected: {csvFile.name}</p>}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 – Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
            <Label>HTML Body</Label>
            <textarea
              className="w-full h-40 border rounded p-2 bg-background"
              value={html}
              onChange={e => setHtml(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 – Confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>CSV: {csvFile?.name}</p>
            <p>Subject: {subject}</p>
            <p>Length: {html.length} chars</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" disabled={step === 1} onClick={back}>
          Back
        </Button>
        {step < 3 ? <Button onClick={next}>Next</Button> : <Button onClick={finish}>Finish</Button>}
      </div>
    </div>
  );
}
