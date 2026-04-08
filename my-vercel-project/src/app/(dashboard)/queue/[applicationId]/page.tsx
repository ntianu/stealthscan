import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { ReviewPanel } from "@/components/applications/review-panel";
import type { ConfidenceBand } from "@prisma/client";

interface Props {
  params: Promise<{ applicationId: string }>;
}

export default async function ApplicationReviewPage({ params }: Props) {
  const user = await requireUser();
  const { applicationId } = await params;

  const [application, userProfile, allQueued] = await Promise.all([
    db.application.findUnique({
      where: { id: applicationId, userId: user.id },
      include: { job: true, resume: true },
    }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.application.findMany({
      where: { userId: user.id, status: "PREPARED" },
      orderBy: [{ savedForLater: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
  ]);

  if (!application) notFound();

  const queueIds = allQueued.map((a) => a.id);
  const pos = queueIds.indexOf(applicationId);
  const prevId = pos > 0 ? queueIds[pos - 1] : null;
  const nextId = pos < queueIds.length - 1 ? queueIds[pos + 1] : null;

  return (
    <>
      <Topbar
        title="Review Application"
        description={`${application.job.title} · ${application.job.company}`}
      />
      <div className="p-6 max-w-3xl">
        <ReviewPanel
          applicationId={application.id}
          job={{
            title: application.job.title,
            company: application.job.company,
            location: application.job.location,
            source: application.job.source,
            applyUrl: application.job.applyUrl,
            salaryMin: application.job.salaryMin,
            salaryMax: application.job.salaryMax,
            remoteType: application.job.remoteType,
            requirements: application.job.requirements,
          }}
          fitScore={application.fitScore}
          fitExplanation={application.fitExplanation}
          coverLetter={application.coverLetter}
          customAnswers={(application.customAnswers as Record<string, string>) ?? null}
          verifierReport={
            application.verifierReport as {
              passed: boolean;
              issues?: string[];
              warnings?: string[];
            } | null
          }
          jobAnalysis={
            application.jobAnalysis as {
              roleSynthesis: string;
              hiddenScorecard: { signal: string; translation: string; dealbreaker: boolean }[];
              rankedBullets: { bulletId: string; content: string; relevanceScore: number; suggestedRewrite: string | null; whyItMatters: string }[];
              coverLetterAngle: string;
              keywords: string[];
              confidenceBand: ConfidenceBand;
              rationale: string;
              risks: string | null;
            } | null
          }
          confidenceBand={(application.confidenceBand as ConfidenceBand | null)}
          rationale={application.rationale}
          risks={application.risks}
          resume={application.resume ? { name: application.resume.name, fileUrl: application.resume.fileUrl } : null}
          status={application.status}
          savedForLater={application.savedForLater}
          hasProfile={!!userProfile}
          prevId={prevId}
          nextId={nextId}
          queueTotal={queueIds.length}
          queuePosition={pos + 1}
        />
      </div>
    </>
  );
}
