"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const WORK_AUTH_OPTIONS = [
  { value: "citizen", label: "US Citizen / Permanent Resident" },
  { value: "greencard", label: "Green Card Holder" },
  { value: "h1b", label: "H-1B (requires sponsorship)" },
  { value: "opt", label: "OPT / CPT" },
  { value: "eu", label: "EU Citizen" },
  { value: "other", label: "Other" },
];

interface UserProfileFormProps {
  initial?: {
    currentTitle?: string | null;
    yearsExperience?: number | null;
    skills?: string[];
    industries?: string[];
    workAuth?: string;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
  } | null;
}

export function UserProfileForm({ initial }: UserProfileFormProps) {
  const [currentTitle, setCurrentTitle] = useState(initial?.currentTitle ?? "");
  const [yearsExperience, setYearsExperience] = useState(initial?.yearsExperience?.toString() ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [industries, setIndustries] = useState<string[]>(initial?.industries ?? []);
  const [workAuth, setWorkAuth] = useState(initial?.workAuth ?? "citizen");
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(initial?.githubUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(initial?.portfolioUrl ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTitle: currentTitle || null,
          yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
          skills,
          industries,
          workAuth,
          linkedinUrl: linkedinUrl || null,
          githubUrl: githubUrl || null,
          portfolioUrl: portfolioUrl || null,
        }),
      });
      if (!res.ok) {
        let msg = "Server error — please try again";
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          msg = await res.text().catch(() => msg);
        }
        throw new Error(msg);
      }
      toast.success("Profile saved");
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Professional background</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Current / most recent job title</Label>
            <Input value={currentTitle} onChange={e => setCurrentTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer" className="mt-1" />
          </div>
          <div>
            <Label>Years of experience</Label>
            <Input type="number" min={0} max={60} value={yearsExperience}
              onChange={e => setYearsExperience(e.target.value)}
              placeholder="e.g. 7" className="mt-1" />
          </div>
          <div>
            <Label>Work authorization</Label>
            <Select value={workAuth} onValueChange={setWorkAuth}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_AUTH_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Skills</Label>
            <TagInput value={skills} onChange={setSkills}
              placeholder="e.g. python, react, postgresql, docker…" className="mt-1" />
            <p className="mt-1 text-xs text-gray-400">Used to calculate your fit score against job requirements</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Industries</Label>
            <TagInput value={industries} onChange={setIndustries}
              placeholder="e.g. fintech, saas, healthcare…" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Online profiles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>LinkedIn URL</Label>
            <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname" className="mt-1" />
          </div>
          <div>
            <Label>GitHub URL</Label>
            <Input value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
              placeholder="https://github.com/yourname" className="mt-1" />
          </div>
          <div>
            <Label>Portfolio URL</Label>
            <Input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)}
              placeholder="https://yoursite.com" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save profile
        </Button>
      </div>
    </div>
  );
}
