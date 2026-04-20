"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, FileText, Building2,
  MapPin, ExternalLink, Loader2, ThumbsUp,
  ClipboardCopy, Check, Sparkles, ChevronLeft, ChevronRight,
  AlertTriangle, ArrowRight, Bookmark, RefreshCw,
} from "lucide-react";
import type { ResumePack } from "@/lib/ai/resume-pack";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApplyKit {
  coverLetter: string | null;
  resumeUrl: string | null;
  answers: Record<string, string>;
  applyUrl: string;
  instructions: string[];
}

interface VerifierReport {
  passed: boolean;
  issues?: string[];
  warnings?: string[];
}

interface HiddenSignal {
  signal: string;
  translation: string;
  dealbreaker: boolean;
}

interface RankedBullet {
  bulletId: string;
  content: string;
  relevanceScore: number;
  suggestedRewrite: string | null;
  whyItMatters: string;
}

type ConfidenceBand = "HIGH" | "MEDIUM" | "EXPLORATORY";

interface JobIntel {
  roleSynthesis: string;
  hiddenScorecard: HiddenSignal[];
  rankedBullets: RankedBullet[];
  coverLetterAngle: string;
  keywords: string[];
  confidenceBand: ConfidenceBand;
  rationale: string;
  risks: string | null;
}

interface GenerateResult {
  coverLetter: string | null;
  customAnswers: Record<string, string> | null;
  verifierReport: VerifierReport | null;
  jobAnalysis: JobIntel | null;
  fitScore: number;
  fitExplanation: string;
  confidenceBand: ConfidenceBand | null;
  rationale: string | null;
  risks: string | null;
  tokensUsed: number;
}

export interface ReviewPanelProps {
  applicationId: string;
  job: {
    title: string;
    company: string;
    location: string | null;
    source: string;
    applyUrl: string;
    salaryMin: number | null;
    salaryMax: number | null;
    remoteType: string | null;
    requirements: string[];
  };
  fitScore: number;
  fitExplanation: string;
  coverLetter: string | null;
  customAnswers: Record<string, string> | null;
  verifierReport: VerifierReport | null;
  jobAnalysis: JobIntel | null;
  confidenceBand: ConfidenceBand | null;
  rationale: string | null;
  risks: string | null;
  resume: { name: string; fileUrl: string } | null;
  status: string;
  savedForLater: boolean;
  hasProfile: boolean;
  prevId: string | null;
  nextId: string | null;
  queueTotal: number;
  queuePosition: number;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
      {children}
    </p>
  );
}

function ConfidencePill({ band }: { band: ConfidenceBand }) {
  const styles: Record<ConfidenceBand, string> = {
    HIGH: "text-emerald-400 border-emerald-400/30 bg-emerald-400/[0.06]",
    MEDIUM: "text-amber-400 border-amber-400/30 bg-amber-400/[0.06]",
    EXPLORATORY: "text-blue-400 border-blue-400/30 bg-blue-400/[0.06]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[band]}`}>
      {band === "HIGH" ? "High confidence" : band === "MEDIUM" ? "Medium confidence" : "Exploratory"}
    </span>
  );
}

// ─── Apply Kit modal ──────────────────────────────────────────────────────────

function ApplyKitModal({ kit, onClose }: { kit: ApplyKit; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Apply Kit Ready</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
          <ol className="space-y-1">
            {kit.instructions.map((step, i) => (
              <li key={i} className="text-sm text-muted-foreground">{step}</li>
            ))}
          </ol>
          <div className="flex gap-3">
            <a href={kit.applyUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 text-xs"><ExternalLink className="h-3.5 w-3.5" /> Open Application</Button>
            </a>
            {kit.resumeUrl && (
              <a href={kit.resumeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Download Resume</Button>
              </a>
            )}
          </div>
          {kit.coverLetter && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cover Letter</p>
                <CopyButton text={kit.coverLetter} />
              </div>
              <pre className="text-xs text-foreground/80 bg-muted/30 rounded-lg p-4 whitespace-pre-wrap border border-border font-sans leading-relaxed max-h-64 overflow-y-auto">
                {kit.coverLetter}
              </pre>
            </div>
          )}
          {Object.keys(kit.answers).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pre-filled Answers</p>
              <div className="space-y-2">
                {Object.entries(kit.answers).map(([q, a]) => (
                  <div key={q} className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{q}</p>
                      <CopyButton text={a} />
                    </div>
                    <p className="mt-1 text-sm text-foreground">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onCancel,
  confirming,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  const [reason, setReason] = useState("");
  const reasons = [
    "Comp too low",
    "Wrong seniority",
    "Not remote-friendly",
    "Company not a fit",
    "Role too narrow",
    "Already applied",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Why are you skipping this?</h3>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                reason === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/[0.08] text-muted-foreground hover:border-white/20"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Or write your own reason…"
          rows={2}
          className="text-xs resize-none"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            className="text-xs"
            onClick={() => onConfirm(reason)}
            disabled={confirming}
          >
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Skip"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Resume Pack section ──────────────────────────────────────────────────────

function ResumePackSection({ applicationId }: { applicationId: string }) {
  const [pack, setPack] = useState<ResumePack | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/resume-pack`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError((data as { error: string }).error ?? "Generation failed"); return; }
      setPack(data as ResumePack);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (!pack) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Generate a tailored headline, summary, and rewritten bullets for this role.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
          onClick={generate}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? "Generating…" : "Generate Resume Pack"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Headline */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Headline</SectionLabel>
          <CopyButton text={pack.headline} />
        </div>
        <p className="text-sm font-semibold text-foreground">{pack.headline}</p>
      </div>

      {/* Summary */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Summary</SectionLabel>
          <CopyButton text={pack.summary} />
        </div>
        <p className="text-xs text-foreground/80 leading-relaxed">{pack.summary}</p>
      </div>

      {/* Bullets */}
      <div>
        <SectionLabel>Tailored bullets ({pack.bullets.length})</SectionLabel>
        <div className="space-y-3">
          {pack.bullets.map((b, i) => (
            <div key={i} className="rounded-lg border border-white/[0.07] bg-card px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] text-muted-foreground/50 line-through leading-relaxed">{b.original}</p>
              <div className="flex items-start gap-2">
                <p className="text-xs text-foreground/90 leading-relaxed flex-1">{b.rewritten}</p>
                <CopyButton text={b.rewritten} />
              </div>
              <p className="text-[10px] text-violet-400/70 italic">{b.improvement}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div>
        <SectionLabel>ATS keywords</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {pack.keywords.map((kw) => (
            <span key={kw} className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">{kw}</span>
          ))}
        </div>
      </div>

      {/* Notes */}
      {pack.notes && (
        <div>
          <SectionLabel>Tailoring notes</SectionLabel>
          <p className="text-xs text-muted-foreground leading-relaxed">{pack.notes}</p>
        </div>
      )}

      <Button
        size="sm" variant="ghost"
        className="text-xs text-muted-foreground gap-1.5"
        onClick={generate}
        disabled={generating}
      >
        {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Regenerate
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewPanel({
  applicationId,
  job,
  fitScore: initialFitScore,
  fitExplanation: initialFitExplanation,
  coverLetter: initialCoverLetter,
  customAnswers: initialCustomAnswers,
  verifierReport: initialVerifierReport,
  jobAnalysis: initialJobAnalysis,
  confidenceBand: initialConfidenceBand,
  rationale: initialRationale,
  risks: initialRisks,
  resume,
  status: initialStatus,
  savedForLater: initialSavedForLater,
  hasProfile,
  prevId,
  nextId,
  queueTotal,
  queuePosition,
}: ReviewPanelProps) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter ?? "");
  const [customAnswers, setCustomAnswers] = useState(initialCustomAnswers);
  const [verifierReport, setVerifierReport] = useState(initialVerifierReport);
  const [jobIntel, setJobIntel] = useState<JobIntel | null>(initialJobAnalysis);
  const [confidenceBand, setConfidenceBand] = useState(initialConfidenceBand);
  const [rationale, setRationale] = useState(initialRationale);
  const [risks, setRisks] = useState(initialRisks);
  const [fitScore, setFitScore] = useState(initialFitScore);
  const [fitExplanation, setFitExplanation] = useState(initialFitExplanation);
  const [savedForLater, setSavedForLater] = useState(initialSavedForLater);
  const [approving, setApproving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [kit, setKit] = useState<ApplyKit | null>(null);
  const [status, setStatus] = useState(initialStatus);

  const isActionable = status === "PREPARED";
  const fitPct = Math.round(fitScore * 100);
  const fitColor = fitPct >= 70 ? "text-emerald-400" : fitPct >= 50 ? "text-amber-400" : "text-red-400";
  const editTrackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fire-and-forget: record that the user opened this review panel
  useEffect(() => {
    fetch(`/api/applications/${applicationId}/open`, { method: "POST" }).catch(() => {});
  }, [applicationId]);

  const trackEdit = useCallback(() => {
    if (editTrackTimer.current) clearTimeout(editTrackTimer.current);
    editTrackTimer.current = setTimeout(() => {
      fetch(`/api/applications/${applicationId}/track-edit`, { method: "POST" }).catch(() => {});
    }, 2000);
  }, [applicationId]);

  const goNext = useCallback(() => {
    if (nextId) router.push(`/queue/${nextId}`);
    else router.push("/queue");
    router.refresh();
  }, [nextId, router]);

  const handleGenerate = useCallback(async () => {
    if (!hasProfile) { toast.error("Complete your Professional Profile in Settings first."); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/generate`, { method: "POST" });
      const data: GenerateResult = await res.json();
      if (!res.ok) { toast.error((data as unknown as { error: string }).error ?? "Generation failed"); return; }
      setCoverLetter(data.coverLetter ?? "");
      setCustomAnswers(data.customAnswers);
      setVerifierReport(data.verifierReport);
      setJobIntel(data.jobAnalysis);
      setFitScore(data.fitScore);
      setFitExplanation(data.fitExplanation);
      if (data.confidenceBand) setConfidenceBand(data.confidenceBand);
      if (data.rationale) setRationale(data.rationale);
      setRisks(data.risks ?? null);
      toast.success("Application packet ready");
    } catch (err) {
      toast.error(`Generation failed: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  }, [applicationId, hasProfile]);

  useEffect(() => {
    if (isActionable && !initialCoverLetter && hasProfile) handleGenerate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: coverLetter || null, customAnswers }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStatus(data.status);
      if (data.kit) { setKit(data.kit as ApplyKit); toast.success("Apply Kit ready!"); }
      else { toast.success("Submitted!"); goNext(); }
    } catch (err) {
      toast.error(`Failed to approve: ${String(err)}`);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (reason: string) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Skipped");
      setShowRejectModal(false);
      goNext();
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setRejecting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/applications/${applicationId}/save`, { method: "POST" });
      setSavedForLater(true);
      toast.success("Saved for later");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const dealbreakers = jobIntel?.hiddenScorecard.filter((s) => s.dealbreaker) ?? [];
  const watchouts = jobIntel?.hiddenScorecard.filter((s) => !s.dealbreaker) ?? [];

  return (
    <>
      {kit && <ApplyKitModal kit={kit} onClose={() => { setKit(null); goNext(); }} />}
      {showRejectModal && (
        <RejectModal
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          confirming={rejecting}
        />
      )}

      <div className="space-y-5">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={!prevId} onClick={() => prevId && router.push(`/queue/${prevId}`)}>
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{queuePosition} / {queueTotal}</span>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={!nextId} onClick={() => nextId && router.push(`/queue/${nextId}`)}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* ── 1. Snapshot ─────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Snapshot</SectionLabel>
          <div className="rounded-lg border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground leading-snug">{job.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.company}</span>
                  {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
                  {job.remoteType && <Badge variant={job.remoteType === "REMOTE" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">{job.remoteType}</Badge>}
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{job.source}</Badge>
                </div>
                {(job.salaryMin || job.salaryMax) && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : "?"} – {job.salaryMax ? `$${job.salaryMax.toLocaleString()}` : "?"} / yr
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {confidenceBand && <ConfidencePill band={confidenceBand} />}
                  {savedForLater && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/20 bg-blue-400/[0.06] px-2 py-0.5 text-[10px] text-blue-400">
                      <Bookmark className="h-2.5 w-2.5" /> Saved for later
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-2xl font-bold tabular-nums ${fitColor}`}>{fitPct}%</div>
                <div className="text-[10px] text-muted-foreground">fit score</div>
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-[10px] text-primary hover:underline justify-end">
                  View job <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            {fitExplanation && (
              <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed border-t border-white/[0.05] pt-3">
                {fitExplanation}
              </p>
            )}
          </div>
        </section>

        {/* ── 2. Why this could be worth it ───────────────────────────────── */}
        {(rationale || jobIntel?.roleSynthesis) && (
          <section>
            <SectionLabel>Why this could be worth it</SectionLabel>
            <div className="rounded-lg border border-emerald-500/[0.12] bg-emerald-500/[0.03] px-4 py-3 space-y-2">
              {rationale && (
                <p className="text-xs text-foreground/80 leading-relaxed">{rationale}</p>
              )}
              {jobIntel?.roleSynthesis && (
                <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-white/[0.05] pt-2">
                  {jobIntel.roleSynthesis}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── 3. Watchouts ────────────────────────────────────────────────── */}
        {(risks || dealbreakers.length > 0 || watchouts.length > 0 || verifierReport) && (
          <section>
            <SectionLabel>Watchouts</SectionLabel>
            <div className="space-y-2">
              {risks && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/90">{risks}</p>
                </div>
              )}
              {dealbreakers.map((s, i) => (
                <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/[0.03] px-3 py-2 flex gap-2 items-start">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground/80">"{s.signal}"</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <ArrowRight className="h-3 w-3 shrink-0" />{s.translation}
                    </p>
                  </div>
                </div>
              ))}
              {watchouts.map((s, i) => (
                <div key={i} className="rounded-lg border border-white/[0.06] bg-muted/20 px-3 py-2 flex gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground/70">"{s.signal}"</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <ArrowRight className="h-3 w-3 shrink-0" />{s.translation}
                    </p>
                  </div>
                </div>
              ))}
              {verifierReport && !verifierReport.passed && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
                  <p className="text-[11px] font-medium text-amber-400 mb-1">Verifier flagged potential issues</p>
                  {verifierReport.issues?.map((issue, i) => (
                    <p key={i} className="text-[10px] text-amber-400/80">⚠ {issue}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── 4. Proof points ─────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Proof points — ranked for this role</SectionLabel>
          {jobIntel && Array.isArray(jobIntel.rankedBullets) && jobIntel.rankedBullets.length > 0 ? (
            <>
              <div className="space-y-2">
                {jobIntel.rankedBullets.map((b, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.06] bg-card px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground truncate">{b.whyItMatters}</span>
                      <span className="text-[10px] font-bold text-violet-400 tabular-nums shrink-0">{Math.round(b.relevanceScore * 100)}%</span>
                    </div>
                    {b.suggestedRewrite ? (
                      <>
                        <p className="text-[11px] text-foreground/40 line-through leading-relaxed">{b.content}</p>
                        <div className="flex items-start gap-2">
                          <p className="text-xs text-foreground/90 leading-relaxed flex-1">{b.suggestedRewrite}</p>
                          <CopyButton text={b.suggestedRewrite} />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-foreground/80 leading-relaxed">{b.content}</p>
                    )}
                  </div>
                ))}
              </div>
              {Array.isArray(jobIntel.keywords) && jobIntel.keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {jobIntel.keywords.map((kw) => (
                    <span key={kw} className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">{kw}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-card px-4 py-4 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {generating
                  ? "Analysing your bullets against this role…"
                  : "Bullet rewrites and role-specific proof points appear here after generation."}
              </p>
              {isActionable && !generating && (
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1 text-violet-400 border-violet-500/30 hover:bg-violet-500/10 shrink-0"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  <Sparkles className="h-3 w-3" /> Generate
                </Button>
              )}
            </div>
          )}
        </section>

        {/* ── 5. Application materials ─────────────────────────────────────── */}
        <section>
          <SectionLabel>Application materials</SectionLabel>
          <Tabs defaultValue="cover-letter">
            <TabsList className="h-8 text-xs mb-3">
              <TabsTrigger value="cover-letter" className="text-xs h-7 px-3">Cover Letter</TabsTrigger>
              <TabsTrigger value="resume-pack" className="text-xs h-7 px-3">Resume Pack</TabsTrigger>
              {customAnswers && Object.keys(customAnswers).length > 0 && (
                <TabsTrigger value="answers" className="text-xs h-7 px-3">Common Q&A</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="cover-letter">
              <div className="rounded-lg border border-white/[0.07] bg-card px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isActionable && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs gap-1 text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
                        onClick={handleGenerate}
                        disabled={generating || approving}
                      >
                        {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {generating ? "Generating…" : coverLetter ? "Regenerate" : "Generate"}
                      </Button>
                    )}
                    {resume && (
                      <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        <FileText className="h-3 w-3" />{resume.name}
                      </a>
                    )}
                  </div>
                  {coverLetter && <CopyButton text={coverLetter} />}
                </div>
                {isActionable ? (
                  generating && !coverLetter ? (
                    <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Writing…
                    </div>
                  ) : (
                    <Textarea
                      value={coverLetter}
                      onChange={e => { setCoverLetter(e.target.value); trackEdit(); }}
                      rows={12}
                      placeholder="No cover letter yet — click Generate."
                      className="text-sm leading-relaxed font-sans"
                    />
                  )
                ) : (
                  <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                    {coverLetter || "No cover letter."}
                  </pre>
                )}
                {verifierReport?.passed && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400/70">
                    <CheckCircle2 className="h-3 w-3" /> Verified — no hallucinations detected
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="resume-pack">
              <div className="rounded-lg border border-white/[0.07] bg-card px-4 py-3">
                <ResumePackSection applicationId={applicationId} />
              </div>
            </TabsContent>

            {customAnswers && Object.keys(customAnswers).length > 0 && (
              <TabsContent value="answers">
                <div className="rounded-lg border border-white/[0.07] bg-card px-4 py-3 space-y-2">
                  {Object.entries(customAnswers).map(([q, a]) => (
                    <div key={q} className="rounded-lg bg-muted/30 p-3 border border-border">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{q}</p>
                        <CopyButton text={a} />
                      </div>
                      <p className="text-sm text-foreground">{a}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </section>

        {/* ── 6. Decision ──────────────────────────────────────────────────── */}
        {isActionable && (
          <section>
            <SectionLabel>Decision</SectionLabel>
            <div className="rounded-lg border border-white/[0.07] bg-card px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => setShowRejectModal(true)}
                  disabled={approving || generating}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Skip
                </Button>
                <Button
                  variant="outline" size="sm"
                  className={`text-xs gap-1.5 ${savedForLater ? "text-blue-400 border-blue-400/30" : "text-muted-foreground border-white/[0.1] hover:text-blue-400 hover:border-blue-400/30"}`}
                  onClick={handleSave}
                  disabled={saving || savedForLater}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                  {savedForLater ? "Saved" : "Save for later"}
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-xs text-muted-foreground gap-1.5"
                  onClick={handleGenerate}
                  disabled={generating || approving}
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Regenerate
                </Button>
              </div>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleApprove}
                disabled={approving || generating}
              >
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                Approve & Submit
              </Button>
            </div>
          </section>
        )}

        {!isActionable && (
          <div className="flex justify-center py-4">
            <Badge variant={status === "SUBMITTED" ? "default" : "secondary"} className="text-xs px-4 py-1">
              {status === "SUBMITTED" && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              {status === "REJECTED" && <XCircle className="h-3.5 w-3.5 mr-1" />}
              {status}
            </Badge>
          </div>
        )}

      </div>
    </>
  );
}
