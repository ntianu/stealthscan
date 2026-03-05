import { Job, SearchProfile } from "@prisma/client";

/**
 * Fast O(1)-per-job elimination pipeline.
 * Returns true if the job passes all hard filters and should be scored.
 */
export function passesHardFilters(job: Job, profile: SearchProfile): boolean {
  const titleLower = job.title.toLowerCase();

  // Title must contain at least one include keyword (if any specified)
  if (profile.titleIncludes.length > 0) {
    const hasMatch = profile.titleIncludes.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );
    if (!hasMatch) return false;
  }

  // Title must not contain any exclude keyword
  for (const kw of profile.titleExcludes) {
    if (titleLower.includes(kw.toLowerCase())) return false;
  }

  // Company blacklist / whitelist
  const companyLower = job.company.toLowerCase();
  if (
    profile.companyBlacklist.some((c) =>
      companyLower.includes(c.toLowerCase())
    )
  ) {
    return false;
  }
  if (
    profile.companyWhitelist.length > 0 &&
    !profile.companyWhitelist.some((c) =>
      companyLower.includes(c.toLowerCase())
    )
  ) {
    return false;
  }

  // Remote type filter
  if (
    profile.remoteTypes.length > 0 &&
    job.remoteType !== null &&
    !profile.remoteTypes.includes(job.remoteType)
  ) {
    return false;
  }

  // Salary range overlap (only filter if both sides have data)
  if (
    profile.minSalary !== null &&
    job.salaryMax !== null &&
    job.salaryMax < profile.minSalary
  ) {
    return false;
  }
  if (
    profile.maxSalary !== null &&
    job.salaryMin !== null &&
    job.salaryMin > profile.maxSalary
  ) {
    return false;
  }

  // Source filter
  if (
    profile.sources.length > 0 &&
    !profile.sources.includes(job.source)
  ) {
    return false;
  }

  return true;
}
