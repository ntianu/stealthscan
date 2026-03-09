/**
 * Remotive job scraper using their free public JSON API.
 * Returns remote jobs only. No authentication required.
 */
import { RawJob } from "./types";

const REMOTIVE_API = "https://remotive.com/api/remote-jobs";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","swift","kotlin",
  "ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];

function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw));
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  "job-count": number;
  jobs: RemotiveJob[];
}

export async function scrapeRemotive(params: {
  query: string;
  maxJobs?: number;
}): Promise<RawJob[]> {
  const { query, maxJobs = 50 } = params;

  const url = new URL(REMOTIVE_API);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(maxJobs));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScanBot/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data: RemotiveResponse = await res.json();
    if (!data.jobs?.length) return [];

    return data.jobs.map((job) => ({
      source: "REMOTIVE" as const,
      externalId: String(job.id),
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || null,
      remoteType: "REMOTE" as const,
      salaryMin: null,
      salaryMax: null,
      description: job.description,
      requirements: [
        ...extractRequirements(job.description),
        ...job.tags.filter((t) => TECH_KEYWORDS.includes(t.toLowerCase())),
      ].filter((v, i, a) => a.indexOf(v) === i),
      applyUrl: job.url,
      postedAt: job.publication_date ? new Date(job.publication_date) : null,
    }));
  } catch {
    return [];
  }
}
