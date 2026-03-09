"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

const REMOTE_TYPES = ["REMOTE", "HYBRID", "ONSITE"] as const;
const SENIORITY_LEVELS = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const;
const JOB_TYPES = ["FULLTIME", "PARTTIME", "CONTRACT", "FREELANCE", "INTERNSHIP"] as const;
const SOURCES = ["LINKEDIN", "WTTJ", "REMOTIVE", "WEWORKREMOTELY", "HACKERNEWS", "JOBICY", "WORKINGNOMADS", "GREENHOUSE", "LEVER"] as const;

type MultiEnum<T extends string> = T[];

interface ProfileFormData {
  name: string;
  active: boolean;
  dailyLimit: number;
  titleIncludes: string[];
  titleExcludes: string[];
  locations: string[];
  remoteTypes: MultiEnum<typeof REMOTE_TYPES[number]>;
  minSalary: string;
  maxSalary: string;
  seniority: MultiEnum<typeof SENIORITY_LEVELS[number]>;
  jobTypes: MultiEnum<typeof JOB_TYPES[number]>;
  industries: string[];
  companyBlacklist: string[];
  companyWhitelist: string[];
  sources: MultiEnum<typeof SOURCES[number]>;
}

interface SearchProfileFormProps {
  initialData?: Partial<ProfileFormData> & { id?: string };
}

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function SearchProfileForm({ initialData }: SearchProfileFormProps) {
  const router = useRouter();
  const isEdit = !!initialData?.id;

  const [form, setForm] = useState<ProfileFormData>({
    name: initialData?.name ?? "",
    active: initialData?.active ?? true,
    dailyLimit: initialData?.dailyLimit ?? 20,
    titleIncludes: initialData?.titleIncludes ?? [],
    titleExcludes: initialData?.titleExcludes ?? [],
    locations: initialData?.locations ?? [],
    remoteTypes: (initialData?.remoteTypes as ProfileFormData["remoteTypes"]) ?? [],
    minSalary: initialData?.minSalary?.toString() ?? "",
    maxSalary: initialData?.maxSalary?.toString() ?? "",
    seniority: (initialData?.seniority as ProfileFormData["seniority"]) ?? [],
    jobTypes: (initialData?.jobTypes as ProfileFormData["jobTypes"]) ?? ["FULLTIME"],
    industries: initialData?.industries ?? [],
    companyBlacklist: initialData?.companyBlacklist ?? [],
    companyWhitelist: initialData?.companyWhitelist ?? [],
    sources: (initialData?.sources as ProfileFormData["sources"]) ?? [],
  });

  const [saving, setSaving] = useState(false);

  function toggle<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Profile name is required");
      return;
    }
    setSaving(true);

    const payload = {
      ...form,
      minSalary: form.minSalary ? parseInt(form.minSalary) : null,
      maxSalary: form.maxSalary ? parseInt(form.maxSalary) : null,
    };

    try {
      const url = isEdit ? `/api/profiles/${initialData!.id}` : "/api/profiles";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(isEdit ? "Profile updated" : "Profile created");
      router.push("/profiles");
      router.refresh();
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Profile name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Senior Backend Engineer"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="dailyLimit">Daily application limit</Label>
            <Input
              id="dailyLimit"
              type="number"
              min={1}
              max={50}
              value={form.dailyLimit}
              onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 20 })}
              className="mt-1"
            />
          </div>
          <div className="flex items-end gap-3">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <span>Active (included in daily scans)</span>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Title filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job title filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Must include (any of these)</Label>
            <TagInput
              value={form.titleIncludes}
              onChange={(v) => setForm({ ...form, titleIncludes: v })}
              placeholder="e.g. engineer, manager…"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Job title must contain at least one of these keywords</p>
          </div>
          <div>
            <Label>Must exclude (all of these)</Label>
            <TagInput
              value={form.titleExcludes}
              onChange={(v) => setForm({ ...form, titleExcludes: v })}
              placeholder="e.g. intern, director…"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Skip jobs containing any of these keywords</p>
          </div>
        </CardContent>
      </Card>

      {/* Location & remote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location & remote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Locations</Label>
            <TagInput
              value={form.locations}
              onChange={(v) => setForm({ ...form, locations: v })}
              placeholder="e.g. new york, london, paris…"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Work type</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {REMOTE_TYPES.map((r) => (
                <ToggleChip
                  key={r}
                  label={r}
                  selected={form.remoteTypes.includes(r)}
                  onToggle={() => setForm({ ...form, remoteTypes: toggle(form.remoteTypes, r) })}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Leave blank to accept any work type</p>
          </div>
        </CardContent>
      </Card>

      {/* Seniority & job type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seniority & job type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Seniority levels</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SENIORITY_LEVELS.map((s) => (
                <ToggleChip
                  key={s}
                  label={s}
                  selected={form.seniority.includes(s)}
                  onToggle={() => setForm({ ...form, seniority: toggle(form.seniority, s) })}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Job types</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {JOB_TYPES.map((j) => (
                <ToggleChip
                  key={j}
                  label={j}
                  selected={form.jobTypes.includes(j)}
                  onToggle={() => setForm({ ...form, jobTypes: toggle(form.jobTypes, j) })}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salary range</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="minSalary">Minimum ($/yr)</Label>
            <Input
              id="minSalary"
              type="number"
              min={0}
              value={form.minSalary}
              onChange={(e) => setForm({ ...form, minSalary: e.target.value })}
              placeholder="e.g. 80000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="maxSalary">Maximum ($/yr)</Label>
            <Input
              id="maxSalary"
              type="number"
              min={0}
              value={form.maxSalary}
              onChange={(e) => setForm({ ...form, maxSalary: e.target.value })}
              placeholder="e.g. 200000"
              className="mt-1"
            />
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Jobs with known salary outside this range will be filtered out. Jobs with no salary data are always included.
          </p>
        </CardContent>
      </Card>

      {/* Companies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Company whitelist</Label>
            <TagInput
              value={form.companyWhitelist}
              onChange={(v) => setForm({ ...form, companyWhitelist: v })}
              placeholder="e.g. stripe, notion…"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">If set, only apply to these companies</p>
          </div>
          <div>
            <Label>Company blacklist</Label>
            <TagInput
              value={form.companyBlacklist}
              onChange={(v) => setForm({ ...form, companyBlacklist: v })}
              placeholder="e.g. acme corp…"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Never apply to these companies</p>
          </div>
        </CardContent>
      </Card>

      {/* Industries & sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Industries & sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Industries</Label>
            <TagInput
              value={form.industries}
              onChange={(v) => setForm({ ...form, industries: v })}
              placeholder="e.g. fintech, healthcare, saas…"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Job board sources</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <ToggleChip
                  key={s}
                  label={s}
                  selected={form.sources.includes(s)}
                  onToggle={() => setForm({ ...form, sources: toggle(form.sources, s) })}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Leave blank to search all sources</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create profile"}
        </Button>
      </div>
    </form>
  );
}
