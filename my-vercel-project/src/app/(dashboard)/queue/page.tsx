import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { QueueCard } from "@/components/applications/queue-card";
import Link from "next/link";
import type { ConfidenceBand } from "@prisma/client";

export default async function QueuePage() {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.id, status: "PREPARED" },
    include: { job: true, resume: true },
    orderBy: [{ savedForLater: "asc" }, { createdAt: "desc" }],
  });

  const total = applications.length;
  const saved = applications.filter((a) => a.savedForLater).length;

  return (
    <>
      <Topbar
        title="Review Queue"
        description={
          total > 0
            ? `${total} opportunit${total === 1 ? "y" : "ies"} waiting${saved > 0 ? ` · ${saved} saved for later` : ""}`
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
          <div className="space-y-2 max-w-2xl">
            {applications.map((app) => (
              <QueueCard
                key={app.id}
                id={app.id}
                jobTitle={app.job.title}
                jobCompany={app.job.company}
                jobLocation={app.job.location}
                jobSource={app.job.source}
                fitScore={app.fitScore}
                confidenceBand={(app.confidenceBand as ConfidenceBand | null)}
                rationale={app.rationale}
                risks={app.risks}
                createdAt={app.createdAt}
                savedForLater={app.savedForLater}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
