"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Building2, MapPin, ExternalLink, Loader2, Plus, CheckCircle2,
  RefreshCw, SlidersHorizontal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface ScoredJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string;
  remoteType: string | null;
  applyUrl: string;
  requirements: string[];
  fetchedAt: string; // ISO string (serialized from server)
  salaryMin: number | null;
  salaryMax: number | null;
  fitScore: number;
  fitExplanation: string;
  matchedSkills: string[];
  missedSkills: string[];
  applicationId: string | null; // existing application if already queued
}

const SOURCES = ["WTTJ", "GREENHOUSE", "LEVER", "INDEED", "LINKEDIN"] as const;
const REMOTE_TYPES = ["REMOTE", "HYBRID", "ONSITE"] as const;

function FitRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="text-right shrink-0">
      <div className={`text-xl font-bold tabular-nums ${color}`}>{pct}%</div>
      <div className="text-[10px] text-muted-foreground">fit</div>
    </div>
  );
}

function JobCard({ job, onPrepare }: { job: ScoredJob; onPrepare: (id: string) => Promise<string | null> }) {
  const [preparing, setPreparing] = useState(false);
  const [applicationId, setApplicationId] = useState(job.applicationId);

  const handlePrepare = async () => {
    setPreparing(true);
    const appId = await onPrepare(job.id);
    if (appId) setApplicationId(appId);
    setPreparing(false);
  };

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardHeader className="pb-1.5 pt-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-snug truncate">{job.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.company}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
              {job.remoteType && <Badge variant={job.remoteType === "REMOTE" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">{job.remoteType}</Badge>}
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{job.source}</Badge>
            </div>
          </div>
          <FitRing score={job.fitScore} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {/* Skill chips */}
        {(job.matchedSkills.length > 0 || job.missedSkills.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {job.matchedSkills.slice(0, 5).map(s => (
              <span key={s} className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">✓ {s}</span>
            ))}
            {job.missedSkills.slice(0, 3).map(s => (
              <span key={s} className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] text-red-400">✗ {s}</span>
            ))}
          </div>
        )}

        {/* Salary */}
        {(job.salaryMin || job.salaryMax) && (
          <p className="text-[10px] text-muted-foreground">
            {job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : "?"} – {job.salaryMax ? `$${job.salaryMax.toLocaleString()}` : "?"}
            {" "}/ yr
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2">
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              View <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(job.fetchedAt), { addSuffix: true })}
            </span>
          </div>

          {applicationId ? (
            <Link href={`/queue/${applicationId}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                <CheckCircle2 className="h-3 w-3" /> In Queue
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handlePrepare} disabled={preparing}>
              {preparing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Prepare
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface JobFeedProps {
  initialJobs: ScoredJob[];
  hasProfile: boolean;
  hasSearchProfile: boolean;
}

export function JobFeed({ initialJobs, hasProfile, hasSearchProfile }: JobFeedProps) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [minFit, setMinFit] = useState(0);
  const [filterSource, setFilterSource] = useState<string[]>([]);
  const [filterRemote, setFilterRemote] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"fit" | "date">("fit");
  const [showFilters, setShowFilters] = useState(false);

  const handleSeed = async () => {
    if (!hasSearchProfile) {
      toast.error("Create a Search Profile first so we know what to look for.");
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch("/api/jobs/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Scan failed");
      } else {
        toast.success(`Scan complete — ${data.inserted} new job${data.inserted !== 1 ? "s" : ""} found`);
        router.refresh();
      }
    } catch {
      toast.error("Scan failed");
    } finally {
      setSeeding(false);
    }
  };

  const handlePrepare = async (jobId: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/jobs/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.info("Already in your queue");
        return data.applicationId;
      }
      if (!res.ok) {
        toast.error(data.error ?? "Failed to prepare");
        return null;
      }
      toast.success("Added to queue!", { action: { label: "Review", onClick: () => router.push(`/queue/${data.applicationId}`) } });
      return data.applicationId;
    } catch {
      toast.error("Failed to prepare application");
      return null;
    }
  };

  const filtered = useMemo(() => {
    let jobs = initialJobs.filter(j => j.fitScore * 100 >= minFit);
    if (filterSource.length > 0) jobs = jobs.filter(j => filterSource.includes(j.source));
    if (filterRemote.length > 0) jobs = jobs.filter(j => j.remoteType && filterRemote.includes(j.remoteType));
    if (sortBy === "fit") jobs = [...jobs].sort((a, b) => b.fitScore - a.fitScore);
    if (sortBy === "date") jobs = [...jobs].sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
    return jobs;
  }, [initialJobs, minFit, filterSource, filterRemote, sortBy]);

  function toggleArr(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  const activeFilters = filterSource.length + filterRemote.length + (minFit > 0 ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSeed} disabled={seeding}>
          {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {seeding ? "Scanning…" : "Scan now"}
        </Button>
        <Button
          variant={showFilters || activeFilters > 0 ? "default" : "outline"}
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Sort:</span>
          {(["fit", "date"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                sortBy === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "fit" ? "Best fit" : "Newest"}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground w-full sm:w-auto">
          {filtered.length} job{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-3 px-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Min fit score: <span className="text-primary font-semibold">{minFit}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minFit}
                onChange={e => setMinFit(parseInt(e.target.value))}
                className="mt-1.5 w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Source</label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterSource(prev => toggleArr(prev, s))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      filterSource.includes(s)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Work type</label>
              <div className="flex flex-wrap gap-1.5">
                {REMOTE_TYPES.map(r => (
                  <button
                    key={r}
                    onClick={() => setFilterRemote(prev => toggleArr(prev, r))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      filterRemote.includes(r)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding nudges */}
      {!hasProfile && (
        <Card className="border-amber-500/20 bg-amber-500/[0.06]">
          <CardContent className="py-2.5 px-4 text-xs text-amber-400">
            Add your skills in{" "}
            <Link href="/settings" className="underline font-medium text-amber-300">
              Settings → Professional profile
            </Link>{" "}
            to get accurate fit scores.
          </CardContent>
        </Card>
      )}
      {!hasSearchProfile && (
        <Card className="border-primary/20 bg-primary/[0.06]">
          <CardContent className="py-2.5 px-4 text-xs text-primary">
            Create a{" "}
            <Link href="/profiles/new" className="underline font-medium">
              Search Profile
            </Link>{" "}
            to tell the scanner what kinds of jobs to find for you.
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <p className="text-sm font-medium text-muted-foreground">No jobs match your current filters.</p>
            {initialJobs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Click <strong className="text-foreground">Scan now</strong> to pull fresh jobs from your search profiles.
              </p>
            )}
            {initialJobs.length > 0 && minFit > 0 && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMinFit(0)}>Clear fit filter</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job list */}
      <div className="space-y-2">
        {filtered.map(job => (
          <JobCard key={job.id} job={job} onPrepare={handlePrepare} />
        ))}
      </div>
    </div>
  );
}
