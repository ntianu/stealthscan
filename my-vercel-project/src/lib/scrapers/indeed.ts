/**
 * Indeed job scraper using Playwright.
 * Note: Playwright must be run in a serverless-compatible environment
 * (not on Vercel Edge). Use this in Node.js API routes or scripts only.
 */
import { RawJob } from "./types";
import { extractRequirements } from "@/lib/matching/scorer";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma",
];

function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw));
}

export interface IndeedScrapeParams {
  query: string;
  location?: string;
  remote?: boolean;
  maxJobs?: number;
}

/**
 * Scrape Indeed for jobs matching the given query.
 * Returns RawJob[] or empty array on error.
 */
export async function scrapeIndeed(
  params: IndeedScrapeParams
): Promise<RawJob[]> {
  const { chromium } = await import("playwright");
  const { query, location = "", remote = false, maxJobs = 25 } = params;
  const jobs: RawJob[] = [];

  const searchUrl = new URL("https://www.indeed.com/jobs");
  searchUrl.searchParams.set("q", query);
  if (location) searchUrl.searchParams.set("l", location);
  if (remote) searchUrl.searchParams.set("remotejob", "032b3046-06a3-4876-8dfd-474eb5e7ed11");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(searchUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const jobCards = await page.$$('[data-jk]');

    for (const card of jobCards.slice(0, maxJobs)) {
      try {
        const jk = await card.getAttribute("data-jk");
        if (!jk) continue;

        const title = await card.$eval(
          '[class*="jobTitle"] a, h2 a',
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        const company = await card.$eval(
          '[data-testid="company-name"], .companyName',
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        const locationText = await card.$eval(
          '[data-testid="text-location"], .companyLocation',
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        if (!title || !company) continue;

        const applyUrl = `https://www.indeed.com/viewjob?jk=${jk}`;

        const remoteType: RawJob["remoteType"] = locationText.toLowerCase().includes("remote")
          ? "REMOTE"
          : locationText.toLowerCase().includes("hybrid")
          ? "HYBRID"
          : "ONSITE";

        jobs.push({
          source: "INDEED",
          externalId: jk,
          title,
          company,
          location: locationText || null,
          remoteType,
          salaryMin: null,
          salaryMax: null,
          description: "",
          requirements: [],
          applyUrl,
          postedAt: null,
        });
      } catch {
        continue;
      }
    }
  } finally {
    await browser.close();
  }

  return jobs;
}
