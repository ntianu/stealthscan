import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanButton } from "@/components/discover/scan-button";
import {
  ClipboardList, Send, Calendar, CheckCircle2,
  ArrowRight, FileText, Plus, TrendingUp, AlertTriangle, Radar,
  BarChart3, Brain,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow, addDays, isBefore, subDays } from "date-fns";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const staleThreshold = subDays(now, 5);

  const [
    prepared,
    submitted,
    interviewing,
    offer,
    upcomingInterviews,
    recentApps,
    lastJob,
    staleCount,
    responded,
    rejected,
    activeProfiles,
    decisionData,
  ] = await Promise.all([
    db.application.count({ where: { userId: user.id, status: "PREPARED" } }),
    db.application.count({ where: { userId: user.id, status: "SUBMITTED" } }),
    db.application.count({ where: { userId: user.id, status: "INTERVIEWING" } }),
    db.application.count({ where: { userId: user.id, status: "OFFER" } }),
    (db.application.findMany as Function)({
      where: { userId: user.id, interviewDate: { gte: now } },
      include: { job: { select: { title: true, company: true } } },
      orderBy: { interviewDate: "asc" },
      take: 5,
    }),
    db.application.findMany({
      where: {
        userId: user.id,
        status: { in: ["SUBMITTED", "INTERVIEWING", "RESPONDED", "OFFER", "REJECTED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true, status: true, fitScore: true, updatedAt: true,
        job: { select: { title: true, company: true } },
      },
    }),
    db.job.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    db.application.count({
      where: { userId: user.id, status: "PREPARED", updatedAt: { lt: staleThreshold } },
    }),
    db.application.count({ where: { userId: user.id, status: "RESPONDED" } }),
    db.application.count({ where: { userId: user.id, status: "REJECTED" } }),
    db.searchProfile.count({ where: { userId: user.id, active: true } }),
    // Decision intelligence data
    db.application.findMany({
      where: {
        userId: user.id,
        status: { in: ["SUBMITTED", "APPROVED", "REJECTED"] },
      },
      select: {
        status: true,
        confidenceBand: true,
        decisionReason: true,
        reviewOpenedAt: true,
        reviewCompletedAt: true,
        coverLetterEdited: true,
      },
    }),
  ]);

  const inFlight = submitted + interviewing;
  const hasData = (prepared + inFlight + offer) > 0;

  // Response rate: (interviews + offers) / total sent (excl. PREPARED)
  const totalSent = submitted + interviewing + responded + offer + rejected;
  const responseRate = totalSent >= 3
    ? Math.round(((interviewing + offer) / totalSent) * 100)
    : null;

  // ── Decision Intelligence ────────────────────────────────────────
  type DecisionRow = typeof decisionData[number];
  const decided = decisionData.filter((d: DecisionRow) =>
    d.status === "SUBMITTED" || d.status === "APPROVED"
  );
  const decisionTotal = decisionData.length;

  // Approval rate by confidence band
  const bandStats: Record<string, { approved: number; total: number }> = {};
  for (const d of decisionData) {
    const band = (d.confidenceBand as string | null) ?? "UNKNOWN";
    if (!bandStats[band]) bandStats[band] = { approved: 0, total: 0 };
    bandStats[band].total++;
    if (d.status === "SUBMITTED" || d.status === "APPROVED") bandStats[band].approved++;
  }

  // Top rejection reasons
  const reasonCounts: Record<string, number> = {};
  for (const d of decisionData) {
    if (d.decisionReason) {
      reasonCounts[d.decisionReason] = (reasonCounts[d.decisionReason] ?? 0) + 1;
    }
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Average time-to-review (minutes)
  const reviewTimes = decisionData
    .filter((d: DecisionRow) => d.reviewOpenedAt && d.reviewCompletedAt)
    .map((d: DecisionRow) =>
      (d.reviewCompletedAt!.getTime() - d.reviewOpenedAt!.getTime()) / 60000
    );
  const avgReviewMinutes =
    reviewTimes.length > 0
      ? Math.round(reviewTimes.reduce((a: number, b: number) => a + b, 0) / reviewTimes.length)
      : null;

  // Cover letter edit rate
  const editRate =
    decided.length > 0
      ? Math.round((decided.filter((d: DecisionRow) => d.coverLetterEdited).length / decided.length) * 100)
      : null;

  const showIntelligence = decisionTotal >= 3;

  // Next 6am scan
  const nextScan = new Date(now);
  nextScan.setHours(6, 0, 0, 0);
  if (nextScan <= now) nextScan.setDate(nextScan.getDate() + 1);

  const statusBadge: Record<string, string> = {
    SUBMITTED:    "bg-emerald-500/15 text-emerald-400",
    INTERVIEWING: "bg-purple-500/15 text-purple-400",
    OFFER:        "bg-green-500/15 text-green-400",
    RESPONDED:    "bg-violet-500/15 text-violet-400",
    REJECTED:     "bg-muted text-muted-foreground",
  };

  return (
    <>
      <Topbar
        title="Dashboard"
        description="Your job search at a glance"
        action={<ScanButton />}
      />
      <div className="p-6 space-y-5">

        {/* ── Stale queue warning ──────────────────────────────────── */}
        {staleCount > 0 && (
          <Card className="border-orange-500/30 bg-orange-500/[0.05]">
            <CardContent className="px-5 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
              <p className="text-sm text-orange-300">
                <span className="font-semibold">{staleCount} application{staleCount !== 1 ? "s" : ""}</span> in your queue {staleCount === 1 ? "has" : "have"} been waiting 5+ days — those jobs may have closed.{" "}
                <Link href="/queue" className="underline hover:text-orange-200">Review now →</Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Primary action ───────────────────────────────────────── */}
        {prepared > 0 && (
          <Link href="/queue">
            <Card className="border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-500/50 transition-colors cursor-pointer">
              <CardContent className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {prepared} application{prepared === 1 ? "" : "s"} waiting for review
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cover letters pre-generated — click to review and submit
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* ── KPI cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "In Queue",   value: prepared,  icon: ClipboardList, color: "text-amber-400",   href: "/queue" },
            { label: "In Flight",  value: inFlight,  icon: Send,          color: "text-emerald-400",  href: "/history" },
            { label: "Offers",     value: offer,     icon: CheckCircle2,  color: "text-green-400",    href: "/history" },
            {
              label: "Response Rate",
              value: responseRate !== null ? `${responseRate}%` : "—",
              icon: TrendingUp,
              color: "text-violet-400",
              href: "/history",
              subtitle: responseRate === null ? "needs 3+ sent" : `${interviewing + offer} of ${totalSent} sent`,
            },
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
                {"subtitle" in stat && stat.subtitle ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.subtitle}</p>
                ) : typeof stat.value === "number" && stat.value > 0 && (
                  <Link href={stat.href} className="text-[11px] text-primary hover:underline mt-0.5 block">
                    View →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Scan status bar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Radar className="h-3 w-3" />
            {lastJob
              ? <>Last scan: <span className="text-foreground">{formatDistanceToNow(lastJob.fetchedAt, { addSuffix: true })}</span></>
              : "No scan run yet"}
            {activeProfiles > 0 && (
              <span className="ml-2 text-muted-foreground/60">·  {activeProfiles} active profile{activeProfiles !== 1 ? "s" : ""}</span>
            )}
          </span>
          <span>
            Next auto-scan: <span className="text-foreground">{format(nextScan, "h:mm a")}</span>
            <span className="text-muted-foreground/60 ml-1">({formatDistanceToNow(nextScan)})</span>
          </span>
        </div>

        {/* ── Decision Intelligence ────────────────────────────────── */}
        {showIntelligence && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-violet-400" />
                Decision Intelligence
              </CardTitle>
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Total reviewed */}
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Reviewed</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{decisionTotal}</p>
                </div>
                {/* Approval rate */}
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Approved</p>
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">
                    {decisionTotal > 0 ? `${Math.round((decided.length / decisionTotal) * 100)}%` : "—"}
                  </p>
                </div>
                {/* Avg review time */}
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Avg review</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {avgReviewMinutes !== null ? `${avgReviewMinutes}m` : "—"}
                  </p>
                </div>
                {/* Edit rate */}
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Edited letters</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {editRate !== null ? `${editRate}%` : "—"}
                  </p>
                </div>
              </div>

              {/* Confidence band breakdown */}
              {Object.keys(bandStats).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Approval by confidence band</p>
                  <div className="space-y-1.5">
                    {(["HIGH", "MEDIUM", "EXPLORATORY"] as const).map((band) => {
                      const s = bandStats[band];
                      if (!s) return null;
                      const pct = Math.round((s.approved / s.total) * 100);
                      const color = band === "HIGH" ? "bg-emerald-400" : band === "MEDIUM" ? "bg-amber-400" : "bg-blue-400";
                      const label = band === "HIGH" ? "High" : band === "MEDIUM" ? "Medium" : "Exploratory";
                      return (
                        <div key={band} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
                          <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">
                            {s.approved}/{s.total} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top rejection reasons */}
              {topReasons.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Top skip reasons</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topReasons.map(([reason, count]) => (
                      <span key={reason}
                        className="rounded-full border border-white/[0.08] bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                        {reason}
                        <span className="ml-1.5 text-muted-foreground/50 tabular-nums">{count}×</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasData ? (
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
                    No upcoming interviews scheduled.
                  </p>
                ) : (
                  <div className="space-y-0.5">
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
                {recentApps.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No activity yet.</p>
                ) : (
                  recentApps.map((app: { id: string; status: string; fitScore: number; updatedAt: Date; job: { title: string; company: string } }) => {
                    const pct = Math.round(app.fitScore * 100);
                    const scoreColor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
                    return (
                      <Link key={app.id} href={`/history/${app.id}`}>
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
                  })
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ── Getting started ──────────────────────────────────── */
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Getting started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Welcome to Stealth Scan. Follow these steps to start finding and applying for jobs:
              </p>
              <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
                <li>
                  <strong className="text-foreground">User Profile</strong> — Add your skills and target roles in{" "}
                  <Link href="/settings" className="text-primary hover:underline">Settings</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Search Profile</strong> — Configure job filters in{" "}
                  <Link href="/profiles" className="text-primary hover:underline">Profiles</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Resumes</strong> — Upload PDFs and tag them in{" "}
                  <Link href="/resumes" className="text-primary hover:underline">Resumes</Link>.
                </li>
                <li>
                  <strong className="text-foreground">Discover</strong> — Click <strong className="text-foreground">Run Scan</strong> above or{" "}
                  <Link href="/discover" className="text-primary hover:underline">add a job by URL</Link>.
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
