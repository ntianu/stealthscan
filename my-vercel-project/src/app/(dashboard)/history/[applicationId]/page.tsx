import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, Building2, MapPin, ExternalLink, CheckCircle2,
  XCircle, FileText, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { TrackingPanel } from "@/components/applications/tracking-panel";

interface Props {
  params: Promise<{ applicationId: string }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SUBMITTED: { label: "Submitted", color: "bg-emerald-500/15 text-emerald-400", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  APPROVED:  { label: "Approved",  color: "bg-blue-500/15 text-blue-400",       icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  REJECTED:  { label: "Skipped",   color: "bg-muted text-muted-foreground",     icon: <XCircle className="h-3.5 w-3.5" /> },
  RESPONDED: { label: "Responded", color: "bg-violet-500/15 text-violet-400",   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

export default async function HistoryDetailPage({ params }: Props) {
  const user = await requireUser();
  const { applicationId } = await params;

  const application = await db.application.findUnique({
    where: { id: applicationId, userId: user.id },
    include: { job: true, resume: true, proof: true },
  });

  if (!application) notFound();

  const proof = application.proof;
  const sc = statusConfig[application.status] ?? statusConfig.APPROVED;
  const fitPct = Math.round(application.fitScore * 100);

  return (
    <>
      <Topbar title="Application Detail" description="Full record of this application" />
      <div className="p-6 max-w-3xl space-y-5">
        <Link href="/history">
          <Button variant="ghost" size="sm" className="mb-2 gap-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to History
          </Button>
        </Link>

        {/* Job summary */}
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground leading-snug">{application.job.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{application.job.company}</span>
                  {application.job.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{application.job.location}</span>
                  )}
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{application.job.source}</Badge>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${sc.color}`}>
                  {sc.icon}{sc.label}
                </span>
                <span className={`text-xl font-bold tabular-nums ${fitPct >= 70 ? "text-emerald-400" : fitPct >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {fitPct}%
                </span>
                <span className="text-[10px] text-muted-foreground">fit</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              {application.submittedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Submitted {format(application.submittedAt, "MMM d, yyyy")}
                </span>
              )}
              <a href={application.job.applyUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline">
                View posting <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Fit explanation */}
        {application.fitExplanation && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Match Explanation</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{application.fitExplanation}</p>
            </CardContent>
          </Card>
        )}

        {/* Resume */}
        {application.resume && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Resume Used</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <FileText className="h-7 w-7 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground">{application.resume.name}</p>
                  <a href={application.resume.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cover letter */}
        {application.coverLetter && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Cover Letter</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {application.coverLetter}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Answers */}
        {application.customAnswers && Object.keys(application.customAnswers as object).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Application Answers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(application.customAnswers as Record<string, string>).map(([q, a]) => (
                <div key={q} className="rounded-lg bg-muted/30 p-3 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{q}</p>
                  <p className="text-sm text-foreground">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Proof packet */}
        {proof && (
          <Card className="border-primary/20 bg-primary/[0.06]">
            <CardHeader className="pb-1.5 pt-3 px-4"><CardTitle className="text-sm text-primary">Proof Packet</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-primary/80 px-4 pb-3">
              <p>Created: {format(proof.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
              {proof.screenshotUrl && (
                <div>
                  <p className="font-medium mb-1">Submission screenshot:</p>
                  <a href={proof.screenshotUrl} target="_blank" rel="noopener noreferrer"
                    className="underline hover:no-underline">
                    View screenshot
                  </a>
                </div>
              )}
              {proof.verifierReport && (
                <div>
                  <p className="font-medium">Verifier: {
                    (proof.verifierReport as { passed: boolean }).passed
                      ? "✓ Passed"
                      : "⚠ Issues found"
                  }</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tracking */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Tracking &amp; Notes</CardTitle></CardHeader>
          <CardContent>
            <TrackingPanel
              applicationId={application.id}
              initialStatus={application.status}
              initialNotes={(application as { notes?: string | null }).notes ?? null}
              initialInterviewDate={
                (application as { interviewDate?: Date | null }).interviewDate?.toISOString() ?? null
              }
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
