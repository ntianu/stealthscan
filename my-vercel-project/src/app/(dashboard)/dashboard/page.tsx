import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ClipboardList, Send, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();

  const [totalJobs, prepared, submitted, responded] = await Promise.all([
    db.job.count(),
    db.application.count({ where: { userId: user.id, status: "PREPARED" } }),
    db.application.count({ where: { userId: user.id, status: "SUBMITTED" } }),
    db.application.count({ where: { userId: user.id, status: "RESPONDED" } }),
  ]);

  const stats = [
    { label: "Jobs Discovered", value: totalJobs, icon: FileText, color: "text-blue-600" },
    { label: "Ready to Review", value: prepared, icon: ClipboardList, color: "text-amber-600" },
    { label: "Submitted", value: submitted, icon: Send, color: "text-green-600" },
    { label: "Got a Response", value: responded, icon: TrendingUp, color: "text-purple-600" },
  ];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>Welcome to AutoApply. Here&apos;s how to get started:</p>
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                <strong>Search Profiles</strong> — Configure your job search filters (title, location, salary, remote preference).
              </li>
              <li>
                <strong>Resumes</strong> — Upload your resume PDFs and tag them by role type.
              </li>
              <li>
                <strong>Bullets</strong> — Add achievement bullets to your library, tagged by competency.
              </li>
              <li>
                <strong>Discover</strong> — Browse jobs found by the daily scan.
              </li>
              <li>
                <strong>Review Queue</strong> — Approve AI-prepared applications before they go out.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
