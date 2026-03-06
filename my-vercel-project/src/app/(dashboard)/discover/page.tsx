import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { JobFeed, type ScoredJob } from "@/components/jobs/job-feed";
import { scoreJob } from "@/lib/matching/scorer";
import { passesHardFilters } from "@/lib/matching/hard-filter";
import type { Seniority } from "@prisma/client";

export default async function DiscoverPage() {
  const user = await requireUser();

  // Load everything in parallel
  const [jobs, userProfile, searchProfiles, existingApplications] = await Promise.all([
    db.job.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fetchedAt: "desc" },
      take: 200,
    }),
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.searchProfile.findMany({ where: { userId: user.id, active: true } }),
    db.application.findMany({
      where: { userId: user.id },
      select: { jobId: true, id: true },
    }),
  ]);

  // Map jobId → existing applicationId for "In Queue" chips
  const appMap = new Map(existingApplications.map(a => [a.jobId, a.id]));

  // Collect preferred seniorities across all active profiles
  const preferredSeniorities: Seniority[] = [
    ...new Set(searchProfiles.flatMap(p => p.seniority) as Seniority[]),
  ];

  // Score every job server-side
  const scoredJobs: ScoredJob[] = jobs.map(job => {
    const passesAny =
      searchProfiles.length === 0 ||
      searchProfiles.some(p => passesHardFilters(job, p));

    const result = userProfile
      ? scoreJob(job, userProfile, preferredSeniorities)
      : { score: 0.5, explanation: "Set up your profile to see fit scores", matchedSkills: [], missedSkills: [] };

    // Soft-penalise jobs that don't pass any profile's hard filters
    const adjustedScore = passesAny ? result.score : result.score * 0.3;

    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      remoteType: job.remoteType,
      applyUrl: job.applyUrl,
      requirements: job.requirements,
      fetchedAt: job.fetchedAt.toISOString(),
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      fitScore: adjustedScore,
      fitExplanation: result.explanation,
      matchedSkills: result.matchedSkills,
      missedSkills: result.missedSkills,
      applicationId: appMap.get(job.id) ?? null,
    };
  });

  scoredJobs.sort((a, b) => b.fitScore - a.fitScore);

  return (
    <>
      <Topbar title="Discover" description="Browse and score matching jobs" />
      <div className="p-6">
        <JobFeed
          initialJobs={scoredJobs}
          hasProfile={!!userProfile}
          hasSearchProfile={searchProfiles.length > 0}
        />
      </div>
    </>
  );
}
