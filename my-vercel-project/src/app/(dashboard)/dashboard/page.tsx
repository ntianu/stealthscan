import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, ClipboardList, Send, TrendingUp, CheckCircle2,
  XCircle, Briefcase, BarChart2,
} from "lucide-react";
import { ApplicationsChart } from "@/components/dashboard/applications-chart";
import { FitScoreDistribution } from "@/components/dashboard/fit-score-distribution";
import { SourceBreakdown } from "@/components/dashboard/source-breakdown";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await requireUser();

  // ---------- Aggregate stats ----------
  const [
    totalJobs,
    totalApplications,
    prepared,
    approved,
    submitted,
    rejected,
    responded,
  ] = await Promise.all([
    db.job.count(),
    db.application.count({ where: { userId: user.id } }),
    db.application.count({ where: { userId: user.id, status: "PREPARED" } }),
    db.application.count({ where: { userId: user.id, status: "APPROVED" } }),
    db.application.count({ where: { userId: user.id, status: "SUBMITTED" } }),
    db.application.count({ where: { userId: user.id, status: "REJECTED" } }),
    db.application.count({ where: { userId: user.id, status: "RESPONDED" } }),
  ]);

  // ---------- Applications created per day (last 30 days) ----------
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentApplications = await db.application.findMany({
    where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const appsByDay: Record<string, { prepared: number; submitted: number; responded: number }> = {};
  for (const app of recentApplications) {
    const day = app.createdAt.toISOString().slice(0, 10);
    if (!appsByDay[day]) appsByDay[day] = { prepared: 0, submitted: 0, responded: 0 };
    if (app.status === "PREPARED") appsByDay[day].prepared++;
    if (app.status === "SUBMITTED") appsByDay[day].submitted++;
    if (app.status === "RESPONDED") appsByDay[day].responded++;
  }
  const chartData = Object.entries(appsByDay).map(([date, counts]) => ({ date, ...counts }));

  // ---------- Fit score distribution ----------
  const allApplications = await db.application.findMany({
    where: { userId: user.id },
    select: { fitScore: true, status: true },
  });

  const buckets = [
    { range: "0–20%", min: 0, max: 0.2, count: 0 },
    { range: "20–40%", min: 0.2, max: 0.4, count: 0 },
    { range: "40–60%", min: 0.4, max: 0.6, count: 0 },
    { range: "60–80%", min: 0.6, max: 0.8, count: 0 },
    { range: "80–100%", min: 0.8, max: 1.01, count: 0 },
  ];
  for (const app of allApplications) {
    const b = buckets.find((bk) => app.fitScore >= bk.min && app.fitScore < bk.max);
    if (b) b.count++;
  }
  const fitDistData = buckets.map((b) => ({ range: b.range, count: b.count }));

  // ---------- Source breakdown ----------
  const jobsBySource = await db.job.groupBy({
    by: ["source"],
    _count: { id: true },
  });
  const sourceData = jobsBySource.map((s) => ({ source: s.source, count: s._count.id }));

  // ---------- Derived rates ----------
  const approvalRate = totalApplications > 0
    ? Math.round(((approved + submitted + responded) / totalApplications) * 100)
    : 0;
  const responseRate = submitted > 0
    ? Math.round((responded / submitted) * 100)
    : 0;
  const avgFitScore = allApplications.length > 0
    ? Math.round((allApplications.reduce((s, a) => s + a.fitScore, 0) / allApplications.length) * 100)
    : 0;

  // ---------- Recent activity ----------
  const recentApps = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      fitScore: true,
      createdAt: true,
      job: { select: { title: true, company: true, source: true } },
    },
  });

  const hasData = totalApplications > 0;

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Jobs Discovered", value: totalJobs, icon: FileText, color: "text-blue-600", sub: null },
            { label: "Ready to Review", value: prepared, icon: ClipboardList, color: "text-amber-600", sub: null, href: "/queue" },
            { label: "Submitted", value: submitted, icon: Send, color: "text-green-600", sub: null },
            { label: "Got a Response", value: responded, icon: TrendingUp, color: "text-purple-600", sub: null },
          ].map((stat) => (
            <Card key={stat.label} className="hover:shadow-sm transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-gray-500">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                {stat.href && stat.value > 0 && (
                  <Link href={stat.href} className="text-xs text-blue-600 hover:underline mt-1 block">
                    Review now →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Rate cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Approval Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{approvalRate}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">of prepared → approved</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Response Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{responseRate}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">of submitted → responded</p>
                </div>
                <BarChart2 className="h-8 w-8 text-purple-400 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Fit Score</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{avgFitScore}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">across all applications</p>
                </div>
                <Briefcase className="h-8 w-8 text-blue-400 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {hasData ? (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Applications Over Time (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ApplicationsChart data={chartData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Fit Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <FitScoreDistribution data={fitDistData} />
                </CardContent>
              </Card>
            </div>

            {/* Source + Recent */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Jobs by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <SourceBreakdown data={sourceData} />
                </CardContent>
              </Card>

              {/* Recent activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentApps.map((app) => {
                    const pct = Math.round(app.fitScore * 100);
                    const color = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500";
                    const statusColor: Record<string, string> = {
                      PREPARED: "bg-amber-100 text-amber-700",
                      APPROVED: "bg-blue-100 text-blue-700",
                      SUBMITTED: "bg-green-100 text-green-700",
                      REJECTED: "bg-gray-100 text-gray-500",
                      RESPONDED: "bg-purple-100 text-purple-700",
                    };
                    return (
                      <div key={app.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <div className="min-w-0 flex-1">
                          <Link href={`/queue/${app.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block">
                            {app.job.title}
                          </Link>
                          <p className="text-xs text-gray-400">{app.job.company} · {app.job.source}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className={`text-xs font-semibold tabular-nums ${color}`}>{pct}%</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[app.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {app.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          /* Empty state / Getting started */
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">Welcome to StealthScan. Follow these steps to start finding and applying for jobs:</p>
              <ol className="list-decimal space-y-2 pl-4 text-sm text-gray-600">
                <li><strong>Professional Profile</strong> — Add your skills and experience in <Link href="/settings" className="text-blue-600 underline">Settings</Link>.</li>
                <li><strong>Search Profiles</strong> — Configure job filters (title, location, salary, remote) in <Link href="/profiles" className="text-blue-600 underline">Search Profiles</Link>.</li>
                <li><strong>Resumes</strong> — Upload your resume PDFs and tag them by role type in <Link href="/resumes" className="text-blue-600 underline">Resumes</Link>.</li>
                <li><strong>Achievement Bullets</strong> — Add quantified bullets to your library in <Link href="/resumes/bullets" className="text-blue-600 underline">Bullets</Link>.</li>
                <li><strong>Discover</strong> — Click "Scan now" in <Link href="/discover" className="text-blue-600 underline">Discover</Link> to find matching jobs.</li>
                <li><strong>Review Queue</strong> — Hit "Prepare" on any job card, then generate AI content and approve in <Link href="/queue" className="text-blue-600 underline">Queue</Link>.</li>
              </ol>
              <div className="pt-2">
                <Link href="/discover">
                  <Button className="gap-2">
                    <FileText className="h-4 w-4" /> Go to Discover
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status breakdown table */}
        {hasData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Application Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 pb-2">Status</th>
                      <th className="text-right text-xs font-medium text-gray-500 pb-2">Count</th>
                      <th className="text-right text-xs font-medium text-gray-500 pb-2">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { status: "PREPARED", value: prepared, icon: <ClipboardList className="h-3.5 w-3.5 text-amber-500" /> },
                      { status: "APPROVED", value: approved, icon: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> },
                      { status: "SUBMITTED", value: submitted, icon: <Send className="h-3.5 w-3.5 text-green-500" /> },
                      { status: "RESPONDED", value: responded, icon: <TrendingUp className="h-3.5 w-3.5 text-purple-500" /> },
                      { status: "REJECTED", value: rejected, icon: <XCircle className="h-3.5 w-3.5 text-gray-400" /> },
                    ].map((row) => (
                      <tr key={row.status}>
                        <td className="py-2 flex items-center gap-2 text-gray-700">
                          {row.icon}
                          {row.status}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-gray-900">{row.value}</td>
                        <td className="py-2 text-right tabular-nums text-gray-500">
                          {totalApplications > 0 ? Math.round((row.value / totalApplications) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
