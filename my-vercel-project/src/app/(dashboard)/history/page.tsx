import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-green-100 text-green-800",
  REJECTED: "bg-gray-100 text-gray-600",
  RESPONDED: "bg-purple-100 text-purple-800",
  APPROVED: "bg-blue-100 text-blue-800",
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
      <Topbar title="Application History" />
      <div className="p-6">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No submitted applications yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <Link key={app.id} href={`/history/${app.id}`}>
                <Card className="cursor-pointer hover:shadow-sm transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{app.job.title}</p>
                        <p className="text-sm text-gray-500">{app.job.company}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              statusColors[app.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {app.status}
                          </span>
                          <p className="mt-1 text-xs text-gray-400">
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
