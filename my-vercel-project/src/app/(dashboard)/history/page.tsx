import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-emerald-500/15 text-emerald-400",
  REJECTED:  "bg-muted text-muted-foreground",
  RESPONDED: "bg-violet-500/15 text-violet-400",
  APPROVED:  "bg-blue-500/15 text-blue-400",
};

export default async function HistoryPage() {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: {
      userId: user.id,
      status: { in: ["SUBMITTED", "REJECTED", "RESPONDED", "APPROVED"] },
    },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <Topbar title="Application History" description="Submitted and completed applications" />
      <div className="p-6">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-xs">
              No submitted applications yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <Link key={app.id} href={`/history/${app.id}`}>
                <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{app.job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{app.job.company}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              statusColors[app.status] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {app.status}
                          </span>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(app.updatedAt, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
