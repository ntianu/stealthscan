import { db } from "@/lib/db";
import { RawJob, makeDedupKey } from "@/lib/scrapers/types";

/**
 * Filter out RawJobs whose dedupKey already exists in the DB.
 * Returns only the new jobs.
 */
export async function filterNewJobs(jobs: RawJob[]): Promise<RawJob[]> {
  if (jobs.length === 0) return [];

  const keys = jobs.map((j) => makeDedupKey(j.company, j.title, j.location));

  const existing = await db.job.findMany({
    where: { dedupKey: { in: keys } },
    select: { dedupKey: true },
  });

  const existingSet = new Set(existing.map((j) => j.dedupKey));

  return jobs.filter(
    (job) => !existingSet.has(makeDedupKey(job.company, job.title, job.location))
  );
}

/**
 * Bulk-insert new jobs, skipping duplicates.
 */
export async function insertNewJobs(jobs: RawJob[]): Promise<number> {
  const newJobs = await filterNewJobs(jobs);
  if (newJobs.length === 0) return 0;

  await db.job.createMany({
    data: newJobs.map((job) => ({
      source: job.source,
      externalId: job.externalId,
      dedupKey: makeDedupKey(job.company, job.title, job.location),
      title: job.title,
      company: job.company,
      location: job.location,
      remoteType: job.remoteType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      description: job.description,
      requirements: job.requirements,
      applyUrl: job.applyUrl,
      postedAt: job.postedAt,
    })),
    skipDuplicates: true,
  });

  return newJobs.length;
}
