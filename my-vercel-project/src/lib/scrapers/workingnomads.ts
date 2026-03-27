/**
 * Working Nomads scraper — free public JSON API, ~30 remote jobs per call.
 * Good for non-engineering roles (product, design, marketing).
 */
import { RawJob } from "./types";
import { extractRequirements } from "@/lib/matching/scorer";

const WN_API = "https://www.workingnomads.com/api/exposed_jobs/";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","swift","kotlin",
  "ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];


interface WNJob {
  url: string;
  title: string;
  description: string;
  company_name: string;
  category_name: string;
  tags: string[];
  location: string;
  pub_date: string;
}

export async function scrapeWorkingNomads(): Promise<RawJob[]> {
  try {
    const res = await fetch(WN_API, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScanBot/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data: WNJob[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.map((job) => {
      // Extract ID from URL slug (last path segment)
      const urlParts = job.url.replace(/\/$/, "").split("/");
      const externalId = urlParts[urlParts.length - 1] || job.url;

      return {
        source: "WORKINGNOMADS" as const,
        externalId,
        title: job.title,
        company: job.company_name,
        location: job.location || null,
        remoteType: "REMOTE" as const,
        salaryMin: null,
        salaryMax: null,
        description: job.description,
        requirements: extractRequirements(job.description, job.tags ?? []),
        applyUrl: job.url,
        postedAt: job.pub_date ? new Date(job.pub_date) : null,
      };
    });
  } catch {
    return [];
  }
}
