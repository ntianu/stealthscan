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
      <Topbar title="Review Queue" />
      <div className="p-6">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p className="text-lg font-medium">Your queue is empty.</p>
              <p className="mt-1 text-sm">
                The daily cron will prepare applications each morning and put them here for your review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <Link key={app.id} href={`/queue/${app.id}`}>
                <Card className="cursor-pointer hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{app.job.title}</CardTitle>
                        <p className="text-sm text-gray-500">{app.job.company}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-blue-600">
                            {Math.round(app.fitScore * 100)}% fit
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDistanceToNow(app.createdAt, { addSuffix: true })}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline">{app.job.source}</Badge>
                      {app.resume && (
                        <span>Resume: {app.resume.name}</span>
                      )}
                      {app.coverLetter && (
                        <Badge variant="secondary" className="text-xs">Cover letter ready</Badge>
                      )}
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
