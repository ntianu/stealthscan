import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, ClipboardList, Send, TrendingUp, CheckCircle2,
  XCircle, Briefcase, Calendar, ArrowRight, Plus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";

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
    interviewing,
    offer,
  ] = await Promise.all([
    db.job.count(),
    db.application.count({ where: { userId: user.id } }),
    db.application.count({ where: { userId: user.id, status: "PREPARED" } }),
    db.application.count({ where: { userId: user.id, status: "APPROVED" } }),
    db.application.count({ where: { userId: user.id, status: "SUBMITTED" } }),
    db.application.count({ where: { userId: user.id, status: "REJECTED" } }),
    db.application.count({ where: { userId: user.id, status: "RESPONDED" } }),
    db.application.count({ where: { userId: user.id, status: "INTERVIEWING" } }),
    db.application.count({ where: { userId: user.id, status: "OFFER" } }),
  ]);

  // ── Upcoming interviews ───────────────────────────────────────────
  const now = new Date();
  const upcomingInterviews = await (db.application.findMany as Function)({
    where: {
      userId: user.id,
      interviewDate: { gte: now },
    },
    include: { job: { select: { title: true, company: true } } },
    orderBy: { interviewDate: "asc" },
    take: 5,
  });

  // ── Recent activity ──────────────────────────────────────────────
  const recentApps = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true, status: true, fitScore: true, updatedAt: true,
      job: { select: { title: true, company: true } },
    },
  });

  // ── Derived metrics ───────────────────────────────────────────────
  const responseRate = submitted > 0 ? Math.round(((responded + interviewing + offer) / submitted) * 100) : 0;
  const allApps = await db.application.findMany({
    where: { userId: user.id },
    select: { fitScore: true },
  });
  const avgFitScore = allApps.length > 0
    ? Math.round((allApps.reduce((s, a) => s + a.fitScore, 0) / allApps.length) * 100)
    : 0;

  const hasData = totalApplications > 0;

  // ── Pipeline stages ───────────────────────────────────────────────
  const pipeline = [
    { label: "Prepared",     value: prepared,     color: "bg-amber-400",  href: "/queue" },
    { label: "Approved",     value: approved,     color: "bg-blue-400",   href: "/queue" },
    { label: "Submitted",    value: submitted,    color: "bg-emerald-400",href: "/history" },
    { label: "Interviewing", value: interviewing, color: "bg-purple-400", href: "/history" },
    { label: "Offer",        value: offer,        color: "bg-green-400",  href: "/history" },
    { label: "Responded",    value: responded,    color: "bg-violet-400", href: "/history" },
    { label: "Rejected",     value: rejected,     color: "bg-muted",      href: "/history" },
  ];
  const maxPipelineVal = Math.max(...pipeline.map(p => p.value), 1);

  const statusBadge: Record<string, string> = {
    PREPARED:     "bg-amber-500/15 text-amber-400",
    APPROVED:     "bg-blue-500/15 text-blue-400",
    SUBMITTED:    "bg-emerald-500/15 text-emerald-400",
    INTERVIEWING: "bg-purple-500/15 text-purple-400",
    OFFER:        "bg-green-500/15 text-green-400",
    RESPONDED:    "bg-violet-500/15 text-violet-400",
    REJECTED:     "bg-muted text-muted-foreground",
  };

  return (
    <>
      <Topbar title="Dashboard" description="Your job search at a glance" />
      <div className="p-6 space-y-5">

        {/* ── KPI cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Jobs in DB",     value: totalJobs,  icon: FileText,      color: "text-primary" },
            { label: "Ready to Review",value: prepared,   icon: ClipboardList, color: "text-amber-400",   href: "/queue" },
            { label: "Interviewing",   value: interviewing,icon: Calendar,     color: "text-purple-400",  href: "/history" },
            { label: "Offers",         value: offer,      icon: CheckCircle2,  color: "text-green-400",   href: "/history" },
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
                    View →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {hasData ? (
          <>
            {/* ── Pipeline funnel ───────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Application Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pipeline.map((stage) => (
                    <div key={stage.label} className="flex items-center gap-3">
                      <div className="w-24 shrink-0 text-[11px] text-muted-foreground text-right">{stage.label}</div>
                      <div className="flex-1 bg-muted/40 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${stage.color}`}
                          style={{ width: `${Math.max((stage.value / maxPipelineVal) * 100, stage.value > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                      <div className="w-8 text-xs font-semibold tabular-nums text-foreground text-right">{stage.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Upcoming interviews + Recent activity ─────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {/* Upcoming interviews */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Upcoming Interviews
                  </CardTitle>
                  <Calendar className="h-3.5 w-3.5 text-purple-400" />
                </CardHeader>
                <CardContent>
                  {upcomingInterviews.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No upcoming interviews. Update status on any application to &ldquo;Interviewing&rdquo; and set a date.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {upcomingInterviews.map((app: { id: string; interviewDate: Date; job: { title: string; company: string } }) => {
                        const isToday = isBefore(app.interviewDate, addDays(now, 1));
                        return (
                          <Link key={app.id} href={`/history/${app.id}`}>
                            <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/20 -mx-1 px-1 rounded transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">{app.job.title}</p>
                                <p className="text-[11px] text-muted-foreground">{app.job.company}</p>
                              </div>
                              <div className="shrink-0 text-right ml-3">
                                <p className={`text-xs font-semibold ${isToday ? "text-red-400" : "text-purple-400"}`}>
                                  {format(app.interviewDate, "MMM d")}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{format(app.interviewDate, "h:mm a")}</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent activity */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Recent Activity
                  </CardTitle>
                  <Link href="/history" className="text-[10px] text-primary hover:underline">View all</Link>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  {recentApps.map((app) => {
                    const pct = Math.round(app.fitScore * 100);
                    const scoreColor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
                    const isQueue = ["PREPARED", "APPROVED"].includes(app.status);
                    const href = isQueue ? `/queue/${app.id}` : `/history/${app.id}`;
                    return (
                      <Link key={app.id} href={href}>
                        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 hover:bg-muted/20 -mx-1 px-1 rounded transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{app.job.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {app.job.company} · {formatDistanceToNow(app.updatedAt, { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span className={`text-xs font-semibold tabular-nums ${scoreColor}`}>{pct}%</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge[app.status] ?? "bg-muted text-muted-foreground"}`}>
                              {app.status}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* ── Metrics row ───────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Applications", value: totalApplications, sub: "across all statuses",    icon: Briefcase,    color: "text-primary" },
                { label: "Response Rate",       value: `${responseRate}%`, sub: "submitted → response", icon: TrendingUp,   color: "text-violet-400" },
                { label: "Avg Fit Score",       value: `${avgFitScore}%`,  sub: "across all apps",       icon: CheckCircle2, color: "text-emerald-400" },
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
                  <strong className="text-foreground">Search Profiles</strong> — Configure filters in{" "}
                  <Link href="/profiles" className="text-primary hover:underline">Search Profiles</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Resumes</strong> — Upload PDFs and tag them in{" "}
                  <Link href="/resumes" className="text-primary hover:underline">Resumes</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Discover</strong> — Click &quot;Run Scan&quot; or{" "}
                  <Link href="/discover" className="text-primary hover:underline">Add a job by URL</Link> to get started.
                </li>
              </ol>
              <div className="pt-1 flex gap-2">
                <Link href="/settings">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5" /> Set up profile
                  </Button>
                </Link>
                <Link href="/discover">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add a job
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
