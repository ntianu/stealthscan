import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { ReviewPanel } from "@/components/applications/review-panel";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface Props {
  params: Promise<{ applicationId: string }>;
}

export default async function ApplicationReviewPage({ params }: Props) {
  const user = await requireUser();
  const { applicationId } = await params;

  const [application, userProfile] = await Promise.all([
    db.application.findUnique({
      where: { id: applicationId, userId: user.id },
      include: { job: true, resume: true },
    }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
  ]);

  if (!application) notFound();

  return (
    <>
      <Topbar title="Review Application" description="Inspect and approve this application" />
      <div className="p-6 max-w-3xl">
        <Link href="/queue">
          <Button variant="ghost" size="sm" className="mb-4 gap-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Queue
          </Button>
        </Link>

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
          resume={application.resume ? { name: application.resume.name, fileUrl: application.resume.fileUrl } : null}
          status={application.status}
          hasProfile={!!userProfile}
        />
      </div>
    </>
  );
}
