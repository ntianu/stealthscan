/**
 * Jobicy scraper — free public JSON API, US-filtered, ~50 remote jobs per call.
 * Has salary data, industry tags, and non-engineering categories (design, marketing, etc.).
 */
import { RawJob } from "./types";

const JOBICY_API = "https://jobicy.com/api/v2/remote-jobs";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","swift","kotlin",
  "ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];

function extractRequirements(html: string, industry: string[]): string[] {
  const lower = html.toLowerCase();
  const fromDesc = TECH_KEYWORDS.filter((kw) => lower.includes(kw));
  const fromIndustry = industry
    .map((i) => i.toLowerCase())
    .filter((i) => TECH_KEYWORDS.includes(i));
  return [...new Set([...fromDesc, ...fromIndustry])];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#038;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface JobicyJob {
  id: number;
  url: string;
  jobSlug: string;
  jobTitle: string;
  companyName: string;
  jobIndustry: string[];
  jobType: string[];
  jobGeo: string;
  jobLevel: string;
  jobDescription: string;
  pubDate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
}

interface JobicyResponse {
  jobCount: number;
  jobs: JobicyJob[];
}

export async function scrapeJobicy(): Promise<RawJob[]> {
  try {
    const url = new URL(JOBICY_API);
    url.searchParams.set("count", "50");
    url.searchParams.set("geo", "usa");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScanBot/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data: JobicyResponse = await res.json();
    if (!data.jobs?.length) return [];

    return data.jobs.map((job) => {
      const description = stripHtml(job.jobDescription);
      // Salary only if yearly USD
      const isYearlyUsd =
        job.salaryCurrency === "USD" &&
        job.salaryPeriod?.toLowerCase() === "yearly";
      const salaryMin = isYearlyUsd && job.salaryMin ? job.salaryMin : null;
      const salaryMax = isYearlyUsd && job.salaryMax ? job.salaryMax : null;

      return {
        source: "JOBICY" as const,
        externalId: String(job.id),
        title: job.jobTitle,
        company: job.companyName,
        location: job.jobGeo || null,
        remoteType: "REMOTE" as const,
        salaryMin,
        salaryMax,
        description,
        requirements: extractRequirements(job.jobDescription, job.jobIndustry),
        applyUrl: job.url,
        postedAt: job.pubDate ? new Date(job.pubDate) : null,
      };
    });
  } catch {
    return [];
  }
}
