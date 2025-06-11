import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PromptVariables {
  greeting_style: "casual" | "professional" | "warm";
  enthusiasm_level: "low" | "medium" | "high";
  formality: "informal" | "semi-formal" | "formal";
  avoid_words: string[];
  preferred_terms: Record<string, string>;
  max_response_length: "short" | "medium" | "long";
  line_break_frequency: "minimal" | "moderate" | "frequent";
  urgency_level: "low" | "medium" | "high";
  education_focus: boolean;
  trust_building_priority: "low" | "medium" | "high";
  never_mention: string[];
  always_include: string[];
  compliance_level: "basic" | "enhanced" | "strict";
}

export default function PromptVariables() {
  const [variables, setVariables] = useState<PromptVariables | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAvoidWord, setNewAvoidWord] = useState("");
  const [newNeverMention, setNewNeverMention] = useState("");
  const [newAlwaysInclude, setNewAlwaysInclude] = useState("");
  const [newPreferredKey, setNewPreferredKey] = useState("");
  const [newPreferredValue, setNewPreferredValue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadVariables();
  }, []);

  const loadVariables = async () => {
    try {
      const response = await apiRequest("/api/test/variables");
      setVariables(response);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load prompt variables",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveVariables = async () => {
    if (!variables) return;

    setSaving(true);
    try {
      await apiRequest("/api/test/variables", {
        method: "POST",
        data: variables,
      });

      toast({
        title: "Success",
        description: "Prompt variables updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update prompt variables",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    setSaving(true);
    try {
      await apiRequest("/api/test/variables/reset", {
        method: "POST",
      });

      await loadVariables();

      toast({
        title: "Success",
        description: "Prompt variables reset to defaults",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset prompt variables",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateVariable = (key: keyof PromptVariables, value: any) => {
    if (!variables) return;
    setVariables({ ...variables, [key]: value });
  };

  const addArrayItem = (key: "avoid_words" | "never_mention" | "always_include", value: string) => {
    if (!variables || !value.trim()) return;
    const currentArray = variables[key];
    if (!currentArray.includes(value.trim())) {
      updateVariable(key, [...currentArray, value.trim()]);
    }
  };

  const removeArrayItem = (
    key: "avoid_words" | "never_mention" | "always_include",
    index: number
  ) => {
    if (!variables) return;
    const currentArray = variables[key];
    updateVariable(
      key,
      currentArray.filter((_, i) => i !== index)
    );
  };

  const addPreferredTerm = () => {
    if (!variables || !newPreferredKey.trim() || !newPreferredValue.trim()) return;
    updateVariable("preferred_terms", {
      ...variables.preferred_terms,
      [newPreferredKey.trim()]: newPreferredValue.trim(),
    });
    setNewPreferredKey("");
    setNewPreferredValue("");
  };

  const removePreferredTerm = (key: string) => {
    if (!variables) return;
    const newTerms = { ...variables.preferred_terms };
    delete newTerms[key];
    updateVariable("preferred_terms", newTerms);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Prompt Variables</h1>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!variables) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Prompt Variables</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Failed to load prompt variables</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompt Variables</h1>
          <p className="text-gray-600">Configure dynamic AI response parameters</p>
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
            Reset to Defaults
          </Button>
          <Button onClick={saveVariables} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Tone and Style */}
      <Card>
        <CardHeader>
          <CardTitle>Tone and Style</CardTitle>
          <CardDescription>Control the overall personality and communication style</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="greeting_style">Greeting Style</Label>
              <Select
                value={variables.greeting_style}
                onValueChange={value => updateVariable("greeting_style", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="enthusiasm_level">Enthusiasm Level</Label>
              <Select
                value={variables.enthusiasm_level}
                onValueChange={value => updateVariable("enthusiasm_level", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="formality">Formality</Label>
              <Select
                value={variables.formality}
                onValueChange={value => updateVariable("formality", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informal">Informal</SelectItem>
                  <SelectItem value="semi-formal">Semi-formal</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Language Preferences</CardTitle>
          <CardDescription>Configure word choices and language constraints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Words to Avoid</Label>
            <div className="flex space-x-2 mb-2">
              <Input
                placeholder="Add word to avoid..."
                value={newAvoidWord}
                onChange={e => setNewAvoidWord(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter") {
                    addArrayItem("avoid_words", newAvoidWord);
                    setNewAvoidWord("");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  addArrayItem("avoid_words", newAvoidWord);
                  setNewAvoidWord("");
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {variables.avoid_words.map((word, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeArrayItem("avoid_words", index)}
                >
                  {word} ✕
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <Label>Preferred Terms</Label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                placeholder="Replace this term..."
                value={newPreferredKey}
                onChange={e => setNewPreferredKey(e.target.value)}
              />
              <Input
                placeholder="With this term..."
                value={newPreferredValue}
                onChange={e => setNewPreferredValue(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter") {
                    addPreferredTerm();
                  }
                }}
              />
            </div>
            <Button variant="outline" onClick={addPreferredTerm} className="mb-2">
              Add Preferred Term
            </Button>
            <div className="space-y-2">
              {Object.entries(variables.preferred_terms).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span>
                    "{key}" → "{value}"
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => removePreferredTerm(key)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Response Structure</CardTitle>
          <CardDescription>Control response length and formatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max_response_length">Maximum Response Length</Label>
              <Select
                value={variables.max_response_length}
                onValueChange={value => updateVariable("max_response_length", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="line_break_frequency">Line Break Frequency</Label>
              <Select
                value={variables.line_break_frequency}
                onValueChange={value => updateVariable("line_break_frequency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="frequent">Frequent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Approach */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Approach</CardTitle>
          <CardDescription>Configure sales strategy and approach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="urgency_level">Urgency Level</Label>
              <Select
                value={variables.urgency_level}
                onValueChange={value => updateVariable("urgency_level", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="trust_building_priority">Trust Building Priority</Label>
              <Select
                value={variables.trust_building_priority}
                onValueChange={value => updateVariable("trust_building_priority", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="compliance_level">Compliance Level</Label>
              <Select
                value={variables.compliance_level}
                onValueChange={value => updateVariable("compliance_level", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="enhanced">Enhanced</SelectItem>
                  <SelectItem value="strict">Strict</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="education_focus"
              checked={variables.education_focus}
              onCheckedChange={checked => updateVariable("education_focus", checked)}
            />
            <Label htmlFor="education_focus">Prioritize Education Over Sales</Label>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Constraints */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Constraints</CardTitle>
          <CardDescription>
            Configure what should never be mentioned and what should always be included
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Never Mention</Label>
            <div className="flex space-x-2 mb-2">
              <Input
                placeholder="Add item to never mention..."
                value={newNeverMention}
                onChange={e => setNewNeverMention(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter") {
                    addArrayItem("never_mention", newNeverMention);
                    setNewNeverMention("");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  addArrayItem("never_mention", newNeverMention);
                  setNewNeverMention("");
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {variables.never_mention.map((item, index) => (
                <Badge
                  key={index}
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={() => removeArrayItem("never_mention", index)}
                >
                  {item} ✕
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <Label>Always Include</Label>
            <div className="flex space-x-2 mb-2">
              <Input
                placeholder="Add item to always include..."
                value={newAlwaysInclude}
                onChange={e => setNewAlwaysInclude(e.target.value)}
                onKeyPress={e => {
                  if (e.key === "Enter") {
                    addArrayItem("always_include", newAlwaysInclude);
                    setNewAlwaysInclude("");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  addArrayItem("always_include", newAlwaysInclude);
                  setNewAlwaysInclude("");
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {variables.always_include.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeArrayItem("always_include", index)}
                >
                  {item} ✕
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}