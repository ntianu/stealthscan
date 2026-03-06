"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const WORK_AUTH_OPTIONS = [
  { value: "citizen",   label: "US Citizen / Permanent Resident" },
  { value: "greencard", label: "Green Card Holder" },
  { value: "h1b",       label: "H-1B (requires sponsorship)" },
  { value: "opt",       label: "OPT / CPT" },
  { value: "eu",        label: "EU Citizen" },
  { value: "other",     label: "Other / Not applicable" },
];

const YEARS_OPTIONS = [
  { value: "",   label: "Select experience level" },
  { value: "0",  label: "< 1 year" },
  { value: "1",  label: "1 year" },
  { value: "2",  label: "2 years" },
  { value: "3",  label: "3 years" },
  { value: "4",  label: "4 years" },
  { value: "5",  label: "5 years" },
  { value: "6",  label: "6 years" },
  { value: "7",  label: "7 years" },
  { value: "8",  label: "8 years" },
  { value: "10", label: "10 years" },
  { value: "12", label: "12 years" },
  { value: "15", label: "15 years" },
  { value: "20", label: "20+ years" },
];

interface UserProfileFormProps {
  initial?: {
    currentTitle?: string | null;
    yearsExperience?: number | null;
    targetRoles?: string[];
    skills?: string[];
    industries?: string[];
    workAuth?: string;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
  } | null;
}

export function UserProfileForm({ initial }: UserProfileFormProps) {
  const [currentTitle, setCurrentTitle]   = useState(initial?.currentTitle ?? "");
  const [yearsExp, setYearsExp]           = useState(initial?.yearsExperience?.toString() ?? "");
  const [targetRoles, setTargetRoles]     = useState<string[]>(initial?.targetRoles ?? []);
  const [skills, setSkills]               = useState<string[]>(initial?.skills ?? []);
  const [industries, setIndustries]       = useState<string[]>(initial?.industries ?? []);
  const [workAuth, setWorkAuth]           = useState(initial?.workAuth ?? "citizen");
  const [linkedinUrl, setLinkedinUrl]     = useState(initial?.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl]         = useState(initial?.githubUrl ?? "");
  const [portfolioUrl, setPortfolioUrl]   = useState(initial?.portfolioUrl ?? "");
  const [saving, setSaving]               = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTitle:   currentTitle || null,
          yearsExperience: yearsExp ? parseInt(yearsExp) : null,
          targetRoles,
          skills,
          industries,
          workAuth,
          linkedinUrl:  linkedinUrl || null,
          githubUrl:    githubUrl || null,
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
    <div className="space-y-5 max-w-2xl">
      {/* ── Background ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Professional background</CardTitle>
          <CardDescription className="text-xs">
            Used to score fit and personalise AI-generated application materials.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium">Current / most recent title</Label>
            <Input
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="mt-1.5 h-9 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Years of experience</Label>
            <Select value={yearsExp} onValueChange={setYearsExp}>
              <SelectTrigger className="mt-1.5 h-9 text-sm">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {YEARS_OPTIONS.filter((o) => o.value !== "").map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Work authorisation</Label>
            <Select value={workAuth} onValueChange={setWorkAuth}>
              <SelectTrigger className="mt-1.5 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_AUTH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Target roles ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Target roles</CardTitle>
          <CardDescription className="text-xs">
            Job titles you&apos;re actively pursuing. Used by the scanner to prioritise
            the most relevant listings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Roles I&apos;m targeting</Label>
            <TagInput
              value={targetRoles}
              onChange={setTargetRoles}
              placeholder="e.g. Senior Engineer, Staff Engineer, EM…"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Press Enter or comma to add each role title.
            </p>
          </div>

          <div>
            <Label className="text-xs font-medium">Industries of interest</Label>
            <TagInput
              value={industries}
              onChange={setIndustries}
              placeholder="e.g. fintech, saas, healthcare, climate…"
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Skills ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Skills</CardTitle>
          <CardDescription className="text-xs">
            Technical and soft skills matched against job requirements to compute your fit score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagInput
            value={skills}
            onChange={setSkills}
            placeholder="e.g. python, react, postgres, docker, leadership…"
          />
        </CardContent>
      </Card>

      {/* ── Online profiles ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Online profiles</CardTitle>
          <CardDescription className="text-xs">
            Optional links included in cover letters and application context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-medium">LinkedIn</Label>
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className="mt-1.5 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">GitHub</Label>
            <Input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/yourname"
              className="mt-1.5 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Portfolio / personal site</Label>
            <Input
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="mt-1.5 h-9 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} size="sm" className="px-5">
          {saving ? (
            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
          ) : (
            "Save profile"
          )}
        </Button>
      </div>
    </div>
  );
}
