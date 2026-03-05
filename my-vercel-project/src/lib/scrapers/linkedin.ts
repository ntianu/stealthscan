/**
 * LinkedIn Easy Apply scraper using Playwright.
 * Requires a valid LinkedIn session cookie (li_at) to be set.
 * Runs in Node.js environment only (not Edge).
 */
import { RawJob } from "./types";

export interface LinkedInScrapeParams {
  query: string;
  location?: string;
  remote?: boolean;
  sessionCookie: string; // li_at cookie value
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

export async function scrapeLinkedIn(
  params: LinkedInScrapeParams
): Promise<RawJob[]> {
  const { chromium } = await import("playwright");
  const { query, location = "", remote = false, sessionCookie, maxJobs = 25 } = params;
  const jobs: RawJob[] = [];

  // Build LinkedIn job search URL with Easy Apply filter (f_AL=true)
  const searchUrl = new URL("https://www.linkedin.com/jobs/search/");
  searchUrl.searchParams.set("keywords", query);
  if (location) searchUrl.searchParams.set("location", location);
  searchUrl.searchParams.set("f_AL", "true"); // Easy Apply only
  if (remote) searchUrl.searchParams.set("f_WT", "2"); // Remote work type

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Set LinkedIn session cookie
  await context.addCookies([
    {
      name: "li_at",
      value: sessionCookie,
      domain: ".linkedin.com",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  try {
    await page.goto(searchUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Scroll to load more results
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1000);
    }

    const jobCards = await page.$$(
      '.jobs-search__results-list li, .scaffold-layout__list-container li'
    );

    for (const card of jobCards.slice(0, maxJobs)) {
      try {
        const title = await card.$eval(
          '.base-search-card__title, h3',
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        const company = await card.$eval(
          '.base-search-card__subtitle, h4',
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        const locationText = await card.$eval(
          '.job-search-card__location, .base-search-card__metadata span',
          (el) => el.textContent?.trim() ?? ""
        ).catch(() => "");

        const linkEl = await card.$("a.base-card__full-link, a[href*='/jobs/']");
        const applyUrl = linkEl ? await linkEl.getAttribute("href") ?? "" : "";
        const externalId = applyUrl.match(/\/jobs\/view\/(\d+)/)?.[1] ?? applyUrl;

        if (!title || !company || !applyUrl) continue;

        const remoteType: RawJob["remoteType"] = locationText.toLowerCase().includes("remote")
          ? "REMOTE"
          : locationText.toLowerCase().includes("hybrid")
          ? "HYBRID"
          : "ONSITE";

        jobs.push({
          source: "LINKEDIN",
          externalId,
          title,
          company,
          location: locationText || null,
          remoteType,
          salaryMin: null,
          salaryMax: null,
          description: "",
          requirements: [],
          applyUrl: applyUrl.startsWith("http")
            ? applyUrl
            : `https://www.linkedin.com${applyUrl}`,
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
