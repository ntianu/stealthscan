"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2, XCircle, AlertCircle, FileText, Building2,
  MapPin, ExternalLink, Loader2, ThumbsUp, ThumbsDown,
  ClipboardCopy, Check, Sparkles, ChevronLeft, ChevronRight,
  Brain, AlertTriangle, ArrowRight,
} from "lucide-react";

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

interface JobIntel {
  roleSynthesis: string;
  hiddenScorecard: HiddenSignal[];
  rankedBullets: RankedBullet[];
  coverLetterAngle: string;
  keywords: string[];
}

interface GenerateResult {
  coverLetter: string | null;
  customAnswers: Record<string, string> | null;
  verifierReport: VerifierReport | null;
  jobAnalysis: JobIntel | null;
  fitScore: number;
  fitExplanation: string;
  tokensUsed: number;
}

interface ReviewPanelProps {
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
  resume: { name: string; fileUrl: string } | null;
  status: string;
  hasProfile: boolean;
  prevId: string | null;
  nextId: string | null;
  queueTotal: number;
  queuePosition: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
    </button>
  );
}

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
              <Button size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Open Application
              </Button>
            </a>
            {kit.resumeUrl && (
              <a href={kit.resumeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" /> Download Resume
                </Button>
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

export function ReviewPanel({
  applicationId,
  job,
  fitScore: initialFitScore,
  fitExplanation: initialFitExplanation,
  coverLetter: initialCoverLetter,
  customAnswers: initialCustomAnswers,
  verifierReport: initialVerifierReport,
  jobAnalysis: initialJobAnalysis,
  resume,
  status: initialStatus,
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
  const [fitScore, setFitScore] = useState(initialFitScore);
  const [fitExplanation, setFitExplanation] = useState(initialFitExplanation);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [kit, setKit] = useState<ApplyKit | null>(null);
  const [status, setStatus] = useState(initialStatus);

  const isActionable = status === "PREPARED";
  const fitPct = Math.round(fitScore * 100);
  const fitColor = fitPct >= 70 ? "text-emerald-400" : fitPct >= 50 ? "text-amber-400" : "text-red-400";

  const handleGenerate = useCallback(async () => {
    if (!hasProfile) {
      toast.error("Complete your Professional Profile in Settings first.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/generate`, { method: "POST" });
      const data: GenerateResult = await res.json();
      if (!res.ok) {
        toast.error((data as unknown as { error: string }).error ?? "Generation failed");
        return;
      }
      setCoverLetter(data.coverLetter ?? "");
      setCustomAnswers(data.customAnswers);
      setVerifierReport(data.verifierReport);
      setJobIntel(data.jobAnalysis);
      setFitScore(data.fitScore);
      setFitExplanation(data.fitExplanation);
      toast.success("Cover letter ready");
    } catch (err) {
      toast.error(`Generation failed: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  }, [applicationId, hasProfile]);

  // Auto-generate when landing on a fresh application that has no cover letter yet
  useEffect(() => {
    if (isActionable && !initialCoverLetter && hasProfile) {
      handleGenerate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    if (nextId) router.push(`/queue/${nextId}`);
    else router.push("/queue");
    router.refresh();
  }, [nextId, router]);

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
      if (data.kit) {
        setKit(data.kit as ApplyKit);
        toast.success("Apply Kit ready!");
      } else {
        toast.success("Submitted!");
        goNext();
      }
    } catch (err) {
      toast.error(`Failed to approve: ${String(err)}`);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/reject`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Skipped");
      goNext();
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <>
      {kit && <ApplyKitModal kit={kit} onClose={() => { setKit(null); goNext(); }} />}

      <div className="space-y-4">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={!prevId}
            onClick={() => prevId && router.push(`/queue/${prevId}`)}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {queuePosition} / {queueTotal}
          </span>
          <Button
            variant="ghost" size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={!nextId}
            onClick={() => nextId && router.push(`/queue/${nextId}`)}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Job header */}
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
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
              </div>
              <div className="text-right shrink-0">
                <div className={`text-2xl font-bold tabular-nums ${fitColor}`}>{fitPct}%</div>
                <div className="text-[10px] text-muted-foreground">fit</div>
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-[10px] text-primary hover:underline justify-end">
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {fitExplanation && (
              <div className="mt-3 rounded-lg bg-primary/[0.06] border border-primary/20 p-3 text-xs text-muted-foreground leading-relaxed">
                {fitExplanation}
              </div>
            )}

            {job.requirements.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {job.requirements.slice(0, 8).map(r => (
                  <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{r}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verifier report */}
        {verifierReport && (
          <Card className={verifierReport.passed
            ? "border-emerald-500/20 bg-emerald-500/[0.06]"
            : "border-amber-500/20 bg-amber-500/[0.06]"}>
            <CardContent className="pt-3 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1.5">
                {verifierReport.passed
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  : <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
                <span className="text-xs font-medium text-foreground">
                  {verifierReport.passed ? "Verifier passed — no hallucinations detected" : "Verifier flagged potential issues"}
                </span>
              </div>
              {verifierReport.issues?.map((issue, i) => (
                <p key={i} className="text-[10px] text-amber-400">⚠ {issue}</p>
              ))}
              {verifierReport.warnings?.map((w, i) => (
                <p key={i} className="text-[10px] text-amber-400/80">• {w}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Job Intel */}
        {jobIntel && (
          <Card className="border-violet-500/20 bg-violet-500/[0.03]">
            <CardHeader className="pb-1.5 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-violet-400 flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5" /> Job Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">

              {/* Role synthesis */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">What this role actually is</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{jobIntel.roleSynthesis}</p>
              </div>

              {/* Hidden scorecard */}
              {jobIntel.hiddenScorecard.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Hidden scorecard</p>
                  <div className="space-y-2">
                    {jobIntel.hiddenScorecard.map((s, i) => (
                      <div key={i} className="rounded-lg bg-muted/30 border border-border px-3 py-2 flex gap-2 items-start">
                        {s.dealbreaker && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground/90">"{s.signal}"</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <ArrowRight className="h-3 w-3 shrink-0" />{s.translation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranked bullets with rewrites */}
              {jobIntel.rankedBullets.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Your bullets — ranked for this role</p>
                  <div className="space-y-2">
                    {jobIntel.rankedBullets.map((b, i) => (
                      <div key={i} className="rounded-lg bg-muted/30 border border-border px-3 py-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground truncate">{b.whyItMatters}</span>
                          <span className="text-[10px] font-bold text-violet-400 tabular-nums shrink-0">{Math.round(b.relevanceScore * 100)}%</span>
                        </div>
                        {b.suggestedRewrite ? (
                          <>
                            <p className="text-[11px] text-foreground/50 line-through leading-relaxed">{b.content}</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-foreground/90 leading-relaxed">{b.suggestedRewrite}</p>
                              <CopyButton text={b.suggestedRewrite} />
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-foreground/80 leading-relaxed">{b.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {jobIntel.keywords.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Mirror these keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {jobIntel.keywords.map((kw) => (
                      <span key={kw} className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Resume */}
        {resume && (
          <Card>
            <CardHeader className="pb-1.5 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected Resume</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-3">
                <FileText className="h-7 w-7 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground">{resume.name}</p>
                  <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cover letter */}
        <Card>
          <CardHeader className="pb-1.5 pt-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cover Letter</CardTitle>
              <div className="flex items-center gap-2">
                {isActionable && (
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs gap-1 text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
                    onClick={handleGenerate}
                    disabled={generating || approving || rejecting}
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {generating ? "Generating…" : coverLetter ? "Regenerate" : "Generate"}
                  </Button>
                )}
                {coverLetter && <CopyButton text={coverLetter} />}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isActionable ? (
              generating && !coverLetter ? (
                <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing cover letter…
                </div>
              ) : (
                <Textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  rows={12}
                  placeholder="No cover letter yet."
                  className="text-sm leading-relaxed font-sans"
                />
              )
            ) : (
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {coverLetter || "No cover letter."}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Custom answers */}
        {customAnswers && Object.keys(customAnswers).length > 0 && (
          <Card>
            <CardHeader className="pb-1.5 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-3">
              {Object.entries(customAnswers).map(([q, a]) => (
                <div key={q} className="rounded-lg bg-muted/30 p-3 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{q}</p>
                    <CopyButton text={a} />
                  </div>
                  <p className="text-sm text-foreground">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isActionable && (
          <div className="flex items-center justify-between pt-2 pb-6">
            <Button variant="outline" onClick={handleReject} disabled={rejecting || approving}
              className="gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400">
              {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
              Skip
            </Button>
            <Button onClick={handleApprove} disabled={approving || rejecting || generating}
              className="gap-1.5 text-xs">
              {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
              Approve & Submit
            </Button>
          </div>
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
