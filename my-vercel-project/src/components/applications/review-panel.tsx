"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, AlertCircle, FileText, Building2,
  MapPin, ExternalLink, Loader2, ThumbsUp, ThumbsDown,
  ClipboardCopy, Check,
} from "lucide-react";

interface ApplyKit {
  coverLetter: string | null;
  resumeUrl: string | null;
  answers: Record<string, string>;
  applyUrl: string;
  instructions: string;
}

interface VerifierReport {
  passed: boolean;
  issues?: string[];
  warnings?: string[];
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
  resume: { name: string; fileUrl: string } | null;
  status: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
    </button>
  );
}

function ApplyKitModal({ kit, onClose }: { kit: ApplyKit; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Apply Kit Ready</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>

          <p className="text-sm text-gray-600">{kit.instructions}</p>

          <div className="flex gap-3">
            <a href={kit.applyUrl} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" /> Open Application
              </Button>
            </a>
            {kit.resumeUrl && (
              <a href={kit.resumeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" /> Download Resume
                </Button>
              </a>
            )}
          </div>

          {kit.coverLetter && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Cover Letter</p>
                <CopyButton text={kit.coverLetter} />
              </div>
              <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap border font-sans leading-relaxed max-h-64 overflow-y-auto">
                {kit.coverLetter}
              </pre>
            </div>
          )}

          {Object.keys(kit.answers).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Pre-filled Answers</p>
              <div className="space-y-3">
                {Object.entries(kit.answers).map(([q, a]) => (
                  <div key={q} className="bg-gray-50 rounded-lg p-3 border">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-gray-700">{q}</p>
                      <CopyButton text={a} />
                    </div>
                    <p className="mt-1 text-sm text-gray-800">{a}</p>
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
  fitScore,
  fitExplanation,
  coverLetter: initialCoverLetter,
  customAnswers,
  verifierReport,
  resume,
  status: initialStatus,
}: ReviewPanelProps) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter ?? "");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [kit, setKit] = useState<ApplyKit | null>(null);
  const [status, setStatus] = useState(initialStatus);

  const isActionable = status === "PREPARED";
  const fitPct = Math.round(fitScore * 100);
  const fitColor = fitPct >= 70 ? "text-green-600" : fitPct >= 50 ? "text-amber-600" : "text-red-500";

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
        toast.success("Application approved — your Apply Kit is ready!");
      } else {
        toast.success("Application submitted successfully!");
        router.push("/queue");
        router.refresh();
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
      toast.success("Application skipped");
      router.push("/queue");
      router.refresh();
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <>
      {kit && <ApplyKitModal kit={kit} onClose={() => { setKit(null); router.push("/queue"); router.refresh(); }} />}

      <div className="space-y-5">
        {/* Job header */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{job.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                  {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                  {job.remoteType && <Badge variant="secondary">{job.remoteType}</Badge>}
                  <Badge variant="outline">{job.source}</Badge>
                </div>
                {(job.salaryMin || job.salaryMax) && (
                  <p className="mt-1 text-sm text-gray-500">
                    Salary: {job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : "?"} – {job.salaryMax ? `$${job.salaryMax.toLocaleString()}` : "?"}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-3xl font-bold ${fitColor}`}>{fitPct}%</div>
                <div className="text-xs text-gray-400">fit score</div>
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  View posting <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {fitExplanation && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
                {fitExplanation}
              </div>
            )}

            {job.requirements.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {job.requirements.slice(0, 8).map(r => (
                  <span key={r} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verifier report */}
        {verifierReport && (
          <Card className={verifierReport.passed
            ? "border-green-200 bg-green-50/30"
            : "border-amber-200 bg-amber-50/30"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                {verifierReport.passed
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <AlertCircle className="h-4 w-4 text-amber-600" />}
                <span className="text-sm font-medium">
                  {verifierReport.passed ? "Verifier passed — no hallucinations detected" : "Verifier flagged potential issues"}
                </span>
              </div>
              {verifierReport.issues?.map((issue, i) => (
                <p key={i} className="text-xs text-amber-700">⚠ {issue}</p>
              ))}
              {verifierReport.warnings?.map((w, i) => (
                <p key={i} className="text-xs text-amber-600">• {w}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Resume */}
        {resume && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Selected Resume</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{resume.name}</p>
                  <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cover letter */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Cover Letter</CardTitle>
              {coverLetter && <CopyButton text={coverLetter} />}
            </div>
          </CardHeader>
          <CardContent>
            {isActionable ? (
              <Textarea
                value={coverLetter}
                onChange={e => setCoverLetter(e.target.value)}
                rows={12}
                placeholder="No cover letter generated. You can write one manually here."
                className="text-sm leading-relaxed font-sans"
              />
            ) : (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {coverLetter || "No cover letter."}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Custom answers */}
        {customAnswers && Object.keys(customAnswers).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Application Questions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(customAnswers).map(([q, a]) => (
                <div key={q} className="rounded-lg bg-gray-50 p-3 border">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">{q}</p>
                    <CopyButton text={a} />
                  </div>
                  <p className="text-sm text-gray-800">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isActionable && (
          <div className="flex items-center justify-between pt-2 pb-6">
            <Button variant="outline" onClick={handleReject} disabled={rejecting || approving}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              Skip
            </Button>
            <Button onClick={handleApprove} disabled={approving || rejecting}
              className="gap-2 bg-green-600 hover:bg-green-700">
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
              Approve & Submit
            </Button>
          </div>
        )}

        {!isActionable && (
          <div className="flex justify-center py-4">
            <Badge variant={status === "SUBMITTED" ? "default" : "secondary"} className="text-sm px-4 py-1">
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
