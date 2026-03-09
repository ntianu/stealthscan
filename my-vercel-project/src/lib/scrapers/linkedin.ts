/**
 * LinkedIn job scraper using LinkedIn's public guest jobs API.
 * No authentication required. Works in serverless environments.
 */
import { RawJob } from "./types";

export interface LinkedInScrapeParams {
  query: string;
  location?: string;
  remoteOnly?: boolean;
  maxJobs?: number;
}

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","swift","kotlin",
];

function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw));
}

function detectRemote(locationText: string): RawJob["remoteType"] {
  const loc = locationText.toLowerCase();
  if (loc.includes("remote")) return "REMOTE";
  if (loc.includes("hybrid")) return "HYBRID";
  return "ONSITE";
}

function parseJobs(html: string): RawJob[] {
  const jobs: RawJob[] = [];

  // Each job card is a <li> containing a data-entity-urn or job view link
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;

  while ((match = liPattern.exec(html)) !== null) {
    const card = match[1];

    // Job ID from URL
    const idMatch = card.match(/\/jobs\/view\/(\d+)/);
    if (!idMatch) continue;
    const externalId = idMatch[1];

    // Title — inside an h3 with base-search-card__title class
    const titleMatch = card.match(
      /class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/
    );
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Company — inside an h4 / anchor with base-search-card__subtitle class
    const companyMatch = card.match(
      /class="[^"]*base-search-card__subtitle[^"]*"[\s\S]*?>([\s\S]*?)<\/(?:h4|a)>/
    );
    const company = companyMatch
      ? companyMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Location — inside span with job-search-card__location class
    const locMatch = card.match(
      /class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/
    );
    const locationText = locMatch
      ? locMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    if (!title || !company) continue;

    const applyUrl = `https://www.linkedin.com/jobs/view/${externalId}/`;

    jobs.push({
      source: "LINKEDIN",
      externalId,
      title,
      company,
      location: locationText || null,
      remoteType: detectRemote(locationText),
      salaryMin: null,
      salaryMax: null,
      description: "",
      requirements: extractRequirements(title),
      applyUrl,
      postedAt: null,
    });
  }

  return jobs;
}

export async function scrapeLinkedIn(
  params: LinkedInScrapeParams
): Promise<RawJob[]> {
  const { query, location = "", remoteOnly = false, maxJobs = 25 } = params;

  const url = new URL(
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
  );
  url.searchParams.set("keywords", query);
  if (location) url.searchParams.set("location", location);
  if (remoteOnly) url.searchParams.set("f_WT", "2"); // 2 = remote
  url.searchParams.set("f_AL", "true"); // Easy Apply only
  url.searchParams.set("count", String(maxJobs));
  url.searchParams.set("start", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.linkedin.com/",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const html = await res.text();
    return parseJobs(html);
  } catch {
    return [];
  }
}
