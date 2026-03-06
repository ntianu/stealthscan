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
  const color = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div className={`text-right shrink-0`}>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{pct}%</div>
      <div className="text-xs text-gray-400">fit</div>
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
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-snug">{job.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.company}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
              {job.remoteType && <Badge variant={job.remoteType === "REMOTE" ? "default" : "secondary"} className="text-xs h-4 px-1.5">{job.remoteType}</Badge>}
              <Badge variant="outline" className="text-xs h-4 px-1.5">{job.source}</Badge>
            </div>
          </div>
          <FitRing score={job.fitScore} />
        </div>
      </CardHeader>
      <CardContent className="pb-4 space-y-2">
        {/* Skill chips */}
        {(job.matchedSkills.length > 0 || job.missedSkills.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {job.matchedSkills.slice(0, 5).map(s => (
              <span key={s} className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">✓ {s}</span>
            ))}
            {job.missedSkills.slice(0, 3).map(s => (
              <span key={s} className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-600">✗ {s}</span>
            ))}
          </div>
        )}

        {/* Salary */}
        {(job.salaryMin || job.salaryMax) && (
          <p className="text-xs text-gray-500">
            {job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : "?"} – {job.salaryMax ? `$${job.salaryMax.toLocaleString()}` : "?"}
            {" "}/ yr
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              View <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(job.fetchedAt), { addSuffix: true })}
            </span>
          </div>

          {applicationId ? (
            <Link href={`/queue/${applicationId}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-200">
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSeed} disabled={seeding}>
          {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {seeding ? "Scanning…" : "Scan now"}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters {(filterSource.length + filterRemote.length > 0 || minFit > 0) ? `(${filterSource.length + filterRemote.length + (minFit > 0 ? 1 : 0)})` : ""}
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-400">Sort:</span>
          {(["fit", "date"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`text-xs px-2 py-1 rounded ${sortBy === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "fit" ? "Best fit" : "Newest"}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 w-full sm:w-auto">{filtered.length} job{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Min fit score: <span className="text-blue-600 font-semibold">{minFit}%</span></label>
              <input type="range" min={0} max={90} step={5} value={minFit}
                onChange={e => setMinFit(parseInt(e.target.value))}
                className="mt-1 w-full accent-blue-600" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Source</label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map(s => (
                  <button key={s} onClick={() => setFilterSource(prev => toggleArr(prev, s))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${filterSource.includes(s) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-500 hover:border-blue-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Work type</label>
              <div className="flex flex-wrap gap-1.5">
                {REMOTE_TYPES.map(r => (
                  <button key={r} onClick={() => setFilterRemote(prev => toggleArr(prev, r))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${filterRemote.includes(r) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-500 hover:border-blue-400"}`}>
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
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-3 text-sm text-amber-800">
            💡 Add your skills in <Link href="/settings" className="underline font-medium">Settings → Professional profile</Link> to get accurate fit scores.
          </CardContent>
        </Card>
      )}
      {!hasSearchProfile && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="py-3 text-sm text-blue-800">
            🔍 Create a <Link href="/profiles/new" className="underline font-medium">Search Profile</Link> to tell the scanner what kinds of jobs to find for you.
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <p className="text-gray-500 font-medium">No jobs match your current filters.</p>
            {initialJobs.length === 0 && (
              <p className="text-sm text-gray-400">
                Click <strong>Scan now</strong> to pull fresh jobs from your search profiles.
              </p>
            )}
            {initialJobs.length > 0 && minFit > 0 && (
              <Button variant="outline" size="sm" onClick={() => setMinFit(0)}>Clear fit filter</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job list */}
      <div className="space-y-3">
        {filtered.map(job => (
          <JobCard key={job.id} job={job} onPrepare={handlePrepare} />
        ))}
      </div>
    </div>
  );
}
