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

  // Split on <li> — each block is one job card
  const liBlocks = html.split("<li>").slice(1);

  for (const block of liBlocks) {
    // Job ID from data-entity-urn attribute
    const idMatch = block.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/);
    if (!idMatch) continue;
    const externalId = idMatch[1];

    // Apply URL — clean slug URL without tracking params
    const urlMatch = block.match(
      /href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/
    );
    const applyUrl = urlMatch
      ? urlMatch[1]
      : `https://www.linkedin.com/jobs/view/${externalId}/`;

    // Title — h3 with base-search-card__title class
    const titleMatch = block.match(
      /<h3[^>]*base-search-card__title[^>]*>\s*([\s\S]*?)\s*<\/h3>/
    );
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Company — anchor with hidden-nested-link class inside the subtitle h4
    const companyMatch = block.match(
      /class="hidden-nested-link"[^>]*>\s*([\s\S]*?)\s*<\/a>/
    );
    const company = companyMatch
      ? companyMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Location — span with job-search-card__location class
    const locMatch = block.match(
      /<span[^>]*job-search-card__location[^>]*>\s*([\s\S]*?)\s*<\/span>/
    );
    const locationText = locMatch
      ? locMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    if (!title || !company) continue;

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
  // Removed f_AL=true (Easy Apply only) — it filters out the majority of jobs
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

    // Log non-200 for scan debug visibility (LinkedIn blocks Vercel AWS IPs with 999/429)
    if (!res.ok) {
      throw new Error(`LinkedIn HTTP ${res.status} for "${query}" — likely IP-blocked (use RSS alert feed instead)`);
    }

    const html = await res.text();
    // If response is too small to contain jobs, LinkedIn returned a challenge page
    if (html.length < 500) {
      throw new Error(`LinkedIn returned ${html.length}b for "${query}" — likely bot-detection page`);
    }
    return parseJobs(html);
  } catch (err) {
    throw err; // Let run-scan.ts log it to errors[]
  }
}
