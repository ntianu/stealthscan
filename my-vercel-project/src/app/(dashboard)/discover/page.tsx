import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function DiscoverPage() {
  await requireUser();

  const jobs = await db.job.findMany({
    where: { status: "ACTIVE" },
    orderBy: { fetchedAt: "desc" },
    take: 50,
  });

  return (
    <>
      <Topbar title="Discover Jobs" />
      <div className="p-6">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p className="text-lg font-medium">No jobs discovered yet.</p>
              <p className="mt-1 text-sm">
                Set up a Search Profile and the daily scan will populate this feed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold text-gray-900">
                        {job.title}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {job.company}
                        </span>
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {job.remoteType && (
                        <Badge
                          variant={job.remoteType === "REMOTE" ? "default" : "secondary"}
                        >
                          {job.remoteType}
                        </Badge>
                      )}
                      <Badge variant="outline">{job.source}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {job.requirements.slice(0, 5).map((req) => (
                        <span
                          key={req}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{formatDistanceToNow(job.fetchedAt, { addSuffix: true })}</span>
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
