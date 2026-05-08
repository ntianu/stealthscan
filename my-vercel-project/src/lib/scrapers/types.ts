import { Source, RemoteType, JobStatus } from "@prisma/client";

/**
 * Canonical job schema that all scrapers normalize to before DB insertion.
 */
export interface RawJob {
  source: Source;
  externalId: string; // platform-specific ID
  title: string;
  company: string;
  location: string | null;
  remoteType: RemoteType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  requirements: string[]; // extracted skill/requirement tokens
  applyUrl: string;
  postedAt: Date | null;
}

/**
 * Compute a deduplication key for a job.
 * Uses company + title + location normalized to lowercase ASCII.
 */
export function makeDedupKey(
  company: string,
  title: string,
  location: string | null
): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const parts = [normalize(company), normalize(title)];
  if (location) parts.push(normalize(location));
  return parts.join("|");
}

export type { Source, RemoteType, JobStatus };
