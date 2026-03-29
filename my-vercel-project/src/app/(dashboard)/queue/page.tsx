import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { QueueCard } from "@/components/applications/queue-card";
import Link from "next/link";

export default async function QueuePage() {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.id, status: "PREPARED" },
    include: { job: true, resume: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Topbar
        title="Review Queue"
        description={
          applications.length > 0
            ? `${applications.length} application${applications.length === 1 ? "" : "s"} waiting`
            : "All caught up"
        }
      />
      <div className="p-6">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm font-medium text-foreground">Queue is empty.</p>
              <p className="mt-1 text-xs">
                The daily scan will add new applications here.{" "}
                <Link href="/discover" className="text-primary hover:underline">Browse jobs manually →</Link>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {applications.map((app: { id: string; fitScore: number; createdAt: Date; coverLetter: string | null; job: { title: string; company: string; source: string }; resume: { name: string } | null }) => (
              <QueueCard
                key={app.id}
                id={app.id}
                jobTitle={app.job.title}
                jobCompany={app.job.company}
                jobSource={app.job.source}
                fitScore={app.fitScore}
                createdAt={app.createdAt}
                resumeName={app.resume?.name ?? null}
                hasCoverLetter={!!app.coverLetter}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
