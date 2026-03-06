import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";

export default async function QueuePage() {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.id, status: "PREPARED" },
    include: { job: true, resume: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Topbar title="Review Queue" description="Applications prepared for your review" />
      <div className="p-6">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm font-medium text-foreground">Your queue is empty.</p>
              <p className="mt-1 text-xs">
                The daily cron will prepare applications each morning and put them here for your review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => {
              const pct = Math.round(app.fitScore * 100);
              const scoreColor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
              return (
              <Link key={app.id} href={`/queue/${app.id}`}>
                <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-1.5 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-semibold truncate">{app.job.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{app.job.company}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <div className="text-right">
                          <div className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                            {pct}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(app.createdAt, { addSuffix: true })}
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{app.job.source}</Badge>
                      {app.resume && (
                        <span className="truncate">Resume: {app.resume.name}</span>
                      )}
                      {app.coverLetter && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Cover letter ready</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
