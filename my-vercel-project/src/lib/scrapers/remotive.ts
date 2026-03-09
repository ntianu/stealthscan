/**
 * RemoteOK scraper — free public JSON API, ~100 fresh jobs, no auth.
 * Replaces Remotive which only had ~10 total jobs.
 * Source enum is kept as REMOTIVE to avoid a schema migration.
 */
import { RawJob } from "./types";

const REMOTEOK_API = "https://remoteok.com/api";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","swift","kotlin",
  "ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];

function extractRequirements(text: string, tags: string[]): string[] {
  const lower = text.toLowerCase();
  const fromDesc = TECH_KEYWORDS.filter((kw) => lower.includes(kw));
  const fromTags = tags
    .map((t) => t.toLowerCase())
    .filter((t) => TECH_KEYWORDS.includes(t));
  return [...new Set([...fromDesc, ...fromTags])];
}

interface RemoteOKJob {
  id: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company: string;
  position: string;
  tags?: string[];
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
  salary_min?: number | null;
  salary_max?: number | null;
}

export async function scrapeRemotive(params: {
  query: string;
}): Promise<RawJob[]> {
  const { query } = params;

  // RemoteOK supports tag-based filtering; extract a single keyword from the query
  // e.g. "Product Manager" → tag=product-manager, "Software Engineer" → tag=engineer
  const tag = query.toLowerCase().replace(/\s+/g, "-");

  // Try tag-filtered first, fall back to all jobs if tag returns empty
  const urls = [
    `${REMOTEOK_API}?tag=${encodeURIComponent(tag)}`,
    REMOTEOK_API,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobScanBot/1.0)",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const data: (RemoteOKJob | { legal?: string })[] = await res.json();
      // First element is a legal notice object, skip it
      const jobs = data.filter(
        (item): item is RemoteOKJob =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "position" in item
      );

      if (jobs.length === 0) continue;

      return jobs.map((job) => {
        const description = job.description ?? "";
        const tags = job.tags ?? [];
        const salaryMin = job.salary_min ? Math.round(job.salary_min) : null;
        const salaryMax = job.salary_max ? Math.round(job.salary_max) : null;
        const applyUrl =
          job.apply_url ?? job.url ?? `https://remoteok.com/remote-jobs/${job.slug ?? job.id}`;
        const postedAt = job.epoch
          ? new Date(job.epoch * 1000)
          : job.date
          ? new Date(job.date)
          : null;

        return {
          source: "REMOTIVE" as const,
          externalId: String(job.id),
          title: job.position,
          company: job.company,
          location: job.location || null,
          remoteType: "REMOTE" as const,
          salaryMin,
          salaryMax,
          description,
          requirements: extractRequirements(description, tags),
          applyUrl,
          postedAt,
        };
      });
    } catch {
      continue;
    }
  }

  return [];
}
