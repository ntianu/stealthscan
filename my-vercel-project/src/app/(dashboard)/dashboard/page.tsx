import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, Send, Calendar, CheckCircle2,
  ArrowRight, FileText, Plus,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow, addDays, isBefore } from "date-fns";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const [
    prepared,
    submitted,
    interviewing,
    offer,
    upcomingInterviews,
    recentApps,
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
  ]);

  const inFlight = submitted + interviewing;
  const hasData = (prepared + inFlight + offer) > 0;

  const statusBadge: Record<string, string> = {
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
                      Click to review and submit
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* ── 3 KPI cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "In Queue",  value: prepared,  icon: ClipboardList, color: "text-amber-400",   href: "/queue" },
            { label: "In Flight", value: inFlight,  icon: Send,          color: "text-emerald-400",  href: "/history" },
            { label: "Offers",    value: offer,     icon: CheckCircle2,  color: "text-green-400",    href: "/history" },
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
                {stat.value > 0 && (
                  <Link href={stat.href} className="text-[11px] text-primary hover:underline mt-0.5 block">
                    View →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

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
                  <Link href="/discover" className="text-primary hover:underline">add a job by URL</Link> to get started.
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
