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

  // ── Aggregate stats ──────────────────────────────────────────────
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

  // ── Applications per day (last 30 days) ─────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentApplications = await db.application.findMany({
    where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const appsByDay: Record<string, { prepared: number; submitted: number; responded: number }> = {};
  for (const app of recentApplications) {
    const day = app.createdAt.toISOString().slice(0, 10);
    if (!appsByDay[day]) appsByDay[day] = { prepared: 0, submitted: 0, responded: 0 };
    if (app.status === "PREPARED")  appsByDay[day].prepared++;
    if (app.status === "SUBMITTED") appsByDay[day].submitted++;
    if (app.status === "RESPONDED") appsByDay[day].responded++;
  }
  const chartData = Object.entries(appsByDay).map(([date, counts]) => ({ date, ...counts }));

  // ── Fit score distribution ───────────────────────────────────────
  const allApplications = await db.application.findMany({
    where: { userId: user.id },
    select: { fitScore: true, status: true },
  });

  const buckets = [
    { range: "0–20%",   min: 0,   max: 0.2,  count: 0 },
    { range: "20–40%",  min: 0.2, max: 0.4,  count: 0 },
    { range: "40–60%",  min: 0.4, max: 0.6,  count: 0 },
    { range: "60–80%",  min: 0.6, max: 0.8,  count: 0 },
    { range: "80–100%", min: 0.8, max: 1.01, count: 0 },
  ];
  for (const app of allApplications) {
    const b = buckets.find((bk) => app.fitScore >= bk.min && app.fitScore < bk.max);
    if (b) b.count++;
  }
  const fitDistData = buckets.map((b) => ({ range: b.range, count: b.count }));

  // ── Source breakdown ─────────────────────────────────────────────
  const jobsBySource = await db.job.groupBy({
    by: ["source"],
    _count: { id: true },
  });
  const sourceData = jobsBySource.map((s) => ({ source: s.source, count: s._count.id }));

  // ── Derived rates ────────────────────────────────────────────────
  const approvalRate = totalApplications > 0
    ? Math.round(((approved + submitted + responded) / totalApplications) * 100)
    : 0;
  const responseRate = submitted > 0
    ? Math.round((responded / submitted) * 100)
    : 0;
  const avgFitScore = allApplications.length > 0
    ? Math.round((allApplications.reduce((s, a) => s + a.fitScore, 0) / allApplications.length) * 100)
    : 0;

  // ── Recent activity ──────────────────────────────────────────────
  const recentApps = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true, status: true, fitScore: true, createdAt: true,
      job: { select: { title: true, company: true, source: true } },
    },
  });

  const hasData = totalApplications > 0;

  return (
    <>
      <Topbar title="Dashboard" description="Your job search at a glance" />
      <div className="p-6 space-y-5">

        {/* ── KPI cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Jobs Discovered",  value: totalJobs,  icon: FileText,      color: "text-primary" },
            { label: "Ready to Review",  value: prepared,   icon: ClipboardList, color: "text-amber-400",  href: "/queue" },
            { label: "Submitted",        value: submitted,  icon: Send,          color: "text-emerald-400" },
            { label: "Got a Response",   value: responded,  icon: TrendingUp,    color: "text-violet-400" },
          ].map((stat) => (
            <Card key={stat.label} className="hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
                <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color} shrink-0`} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</div>
                {"href" in stat && stat.href && stat.value > 0 && (
                  <Link href={stat.href} className="text-[11px] text-primary hover:underline mt-0.5 block">
                    Review now →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Rate cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Approval Rate",  value: `${approvalRate}%`,  sub: "prepared → approved",  icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Response Rate",  value: `${responseRate}%`,  sub: "submitted → responded", icon: BarChart2,    color: "text-violet-400" },
            { label: "Avg Fit Score",  value: `${avgFitScore}%`,   sub: "across all applications", icon: Briefcase,  color: "text-primary" },
          ].map((r) => (
            <Card key={r.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{r.label}</p>
                    <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{r.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.sub}</p>
                  </div>
                  <r.icon className={`h-7 w-7 ${r.color} shrink-0 opacity-70`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {hasData ? (
          <>
            {/* ── Charts ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Applications — 30 days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ApplicationsChart data={chartData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Fit Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FitScoreDistribution data={fitDistData} />
                </CardContent>
              </Card>
            </div>

            {/* ── Source + Recent ───────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Jobs by Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SourceBreakdown data={sourceData} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {recentApps.map((app) => {
                    const pct = Math.round(app.fitScore * 100);
                    const scoreColor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
                    const statusColor: Record<string, string> = {
                      PREPARED:  "bg-amber-500/15 text-amber-400",
                      APPROVED:  "bg-blue-500/15 text-blue-400",
                      SUBMITTED: "bg-emerald-500/15 text-emerald-400",
                      REJECTED:  "bg-muted text-muted-foreground",
                      RESPONDED: "bg-violet-500/15 text-violet-400",
                    };
                    return (
                      <div key={app.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                        <div className="min-w-0 flex-1">
                          <Link href={`/queue/${app.id}`} className="text-xs font-medium text-foreground hover:text-primary truncate block">
                            {app.job.title}
                          </Link>
                          <p className="text-[11px] text-muted-foreground">{app.job.company} · {app.job.source}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className={`text-xs font-semibold tabular-nums ${scoreColor}`}>{pct}%</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[app.status] ?? "bg-muted text-muted-foreground"}`}>
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
          /* ── Empty / Getting started ────────────────────────────── */
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Getting started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Welcome to StealthScan. Follow these steps to start finding and applying for jobs:
              </p>
              <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
                <li>
                  <strong className="text-foreground">Professional Profile</strong> — Add your skills and target roles in{" "}
                  <Link href="/settings" className="text-primary hover:underline">Settings</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Search Profiles</strong> — Configure filters (title, location, salary, remote) in{" "}
                  <Link href="/profiles" className="text-primary hover:underline">Search Profiles</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Resumes</strong> — Upload PDFs and tag them by role type in{" "}
                  <Link href="/resumes" className="text-primary hover:underline">Resumes</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Achievement Bullets</strong> — Add quantified bullets in{" "}
                  <Link href="/resumes/bullets" className="text-primary hover:underline">Bullets</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Discover</strong> — Click &quot;Scan now&quot; in{" "}
                  <Link href="/discover" className="text-primary hover:underline">Discover</Link> to find matching jobs.
                </li>
                <li>
                  <strong className="text-foreground">Review Queue</strong> — Prepare, generate AI content, and approve in{" "}
                  <Link href="/queue" className="text-primary hover:underline">Queue</Link>.
                </li>
              </ol>
              <div className="pt-1">
                <Link href="/settings">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5" /> Set up your profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Status breakdown table ───────────────────────────────── */}
        {hasData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-[10px] font-medium text-muted-foreground pb-2 uppercase tracking-wide">Status</th>
                      <th className="text-right text-[10px] font-medium text-muted-foreground pb-2 uppercase tracking-wide">Count</th>
                      <th className="text-right text-[10px] font-medium text-muted-foreground pb-2 uppercase tracking-wide">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[
                      { status: "PREPARED",  value: prepared,  icon: <ClipboardList className="h-3 w-3 text-amber-400" /> },
                      { status: "APPROVED",  value: approved,  icon: <CheckCircle2 className="h-3 w-3 text-blue-400" /> },
                      { status: "SUBMITTED", value: submitted, icon: <Send className="h-3 w-3 text-emerald-400" /> },
                      { status: "RESPONDED", value: responded, icon: <TrendingUp className="h-3 w-3 text-violet-400" /> },
                      { status: "REJECTED",  value: rejected,  icon: <XCircle className="h-3 w-3 text-muted-foreground" /> },
                    ].map((row) => (
                      <tr key={row.status}>
                        <td className="py-2 flex items-center gap-2 text-foreground/80">
                          {row.icon}
                          {row.status}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-foreground">{row.value}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
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
