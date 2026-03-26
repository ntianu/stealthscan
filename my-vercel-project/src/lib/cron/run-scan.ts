import { db } from "@/lib/db";
import { scrapeWttj } from "@/lib/scrapers/wttj";
import { scrapeGreenhouseMany } from "@/lib/scrapers/greenhouse";
import { scrapeLeverMany } from "@/lib/scrapers/lever";
import { scrapeLinkedInApify, parseLinkedInSearchUrl } from "@/lib/scrapers/linkedin-apify";
import { scrapeBuiltInApify } from "@/lib/scrapers/builtin-apify";
import { scrapeRemotive } from "@/lib/scrapers/remotive";
import { scrapeWwr } from "@/lib/scrapers/wwr";
import { scrapeHackerNews } from "@/lib/scrapers/hn";
import { scrapeJobicy } from "@/lib/scrapers/jobicy";
import { scrapeWorkingNomads } from "@/lib/scrapers/workingnomads";
import { scrapeRssFeeds } from "@/lib/scrapers/rss";
import { insertNewJobs } from "@/lib/matching/dedup";
import type { RawJob } from "@/lib/scrapers/types";

/** Keep only jobs whose title contains at least one meaningful word from the query. */
function filterByQueryRelevance(jobs: RawJob[], query: string): RawJob[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return jobs;
  return jobs.filter((job) => {
    const title = job.title.toLowerCase();
    return words.some((w) => title.includes(w));
  });
}

/** Remote jobs and jobs with no location always pass. */
function filterByProfileLocations(jobs: RawJob[], locations: string[]): RawJob[] {
  if (locations.length === 0) return jobs;
  return jobs.filter((job) => {
    if (job.remoteType === "REMOTE") return true;
    if (!job.location) return true;
    const jobLoc = job.location.toLowerCase();
    return locations.some(
      (loc) => jobLoc.includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobLoc)
    );
  });
}

export interface ScanResult {
  message: string;
  profilesScanned: number;
  fetched: number;
  inserted: number;
  deduped: number;
  errors: string[];
  debug: string[];
}

// ─── Scraper task helpers ─────────────────────────────────────────────────────

interface ScraperTask {
  name: string;
  query: string;
  fn: () => Promise<RawJob[]>;
}

function buildScraperTasks(
  profile: {
    sources: string[];
    locations: string[];
    remoteTypes: string[];
    companyWhitelist: string[];
    rssFeeds: string[];
    linkedinSearchUrls: string[];
  },
  queries: string[],
  location: string,
  remoteOnly: boolean
): ScraperTask[] {
  const tasks: ScraperTask[] = [];
  const noSourceFilter = profile.sources.length === 0;

  // WTTJ — one task per query (max 3)
  if (noSourceFilter || profile.sources.includes("WTTJ")) {
    for (const query of queries.slice(0, 3)) {
      tasks.push({
        name: `WTTJ "${query}"`,
        query,
        fn: () => scrapeWttj({ query, location, remoteOnly }),
      });
    }
  }

  // Greenhouse — per-company, filter-based
  if (profile.sources.includes("GREENHOUSE") && profile.companyWhitelist.length > 0) {
    const slugs = profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""));
    tasks.push({
      name: "Greenhouse",
      query: queries[0] ?? "",
      fn: () => scrapeGreenhouseMany(slugs),
    });
  }

  // Lever — per-company, filter-based
  if (profile.sources.includes("LEVER") && profile.companyWhitelist.length > 0) {
    const slugs = profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""));
    tasks.push({
      name: "Lever",
      query: queries[0] ?? "",
      fn: () => scrapeLeverMany(slugs),
    });
  }

  const hasApifyToken = !!process.env.APIFY_API_TOKEN;

  // LinkedIn via Apify — profile-level queries
  if (noSourceFilter || profile.sources.includes("LINKEDIN")) {
    if (!hasApifyToken) {
      // Will produce a debug entry but no task
    } else {
      tasks.push({
        name: "LinkedIn (Apify — profile queries)",
        query: queries[0] ?? "",
        fn: () =>
          scrapeLinkedInApify({
            queries: queries.slice(0, 3),
            locations: profile.locations,
            maxItemsPerQuery: 25,
            postedLimit: "week",
          }),
      });
    }
  }

  // LinkedIn via Apify — user-pasted search URLs (each URL = separate Apify call)
  if (hasApifyToken && profile.linkedinSearchUrls.length > 0) {
    for (const rawUrl of profile.linkedinSearchUrls) {
      const parsed = parseLinkedInSearchUrl(rawUrl);
      if (!parsed || parsed.jobTitles.length === 0) continue;
      const label = parsed.jobTitles[0].slice(0, 40);
      tasks.push({
        name: `LinkedIn (URL: "${label}")`,
        query: parsed.jobTitles[0],
        fn: () =>
          scrapeLinkedInApify({
            queries: parsed.jobTitles,
            locations: parsed.locations.length > 0 ? parsed.locations : profile.locations,
            maxItemsPerQuery: 25,
            postedLimit: parsed.postedLimit ?? "week",
            workplaceType: parsed.workplaceType,
            employmentType: parsed.employmentType,
            experienceLevel: parsed.experienceLevel,
          }),
      });
    }
  }

  if (!hasApifyToken && (noSourceFilter || profile.sources.includes("LINKEDIN"))) {
    // Placeholder — handled as a debug note below
  }

  // BuiltIn via Apify
  if (noSourceFilter || profile.sources.includes("BUILTIN")) {
    if (hasApifyToken) {
      tasks.push({
        name: "BuiltIn (Apify)",
        query: queries[0] ?? "",
        fn: () =>
          scrapeBuiltInApify({
            keyword: queries[0] ?? "",
            location: profile.locations[0],
            maxResults: 30,
          }),
      });
    }
  }

  // RemoteOK — one per query
  if (noSourceFilter || profile.sources.includes("REMOTIVE")) {
    for (const query of queries.slice(0, 3)) {
      tasks.push({
        name: `RemoteOK "${query}"`,
        query,
        fn: () => scrapeRemotive({ query }),
      });
    }
  }

  // We Work Remotely — one per query
  if (noSourceFilter || profile.sources.includes("WEWORKREMOTELY")) {
    for (const query of queries.slice(0, 3)) {
      tasks.push({
        name: `WWR "${query}"`,
        query,
        fn: () => scrapeWwr({ query }),
      });
    }
  }

  // Jobicy
  if (noSourceFilter || profile.sources.includes("JOBICY")) {
    tasks.push({
      name: "Jobicy",
      query: queries[0] ?? "",
      fn: () => scrapeJobicy(),
    });
  }

  // Working Nomads
  if (noSourceFilter || profile.sources.includes("WORKINGNOMADS")) {
    tasks.push({
      name: "WorkingNomads",
      query: queries[0] ?? "",
      fn: () => scrapeWorkingNomads(),
    });
  }

  // Hacker News
  if (noSourceFilter || profile.sources.includes("HACKERNEWS")) {
    tasks.push({
      name: `HN "${queries[0] ?? ""}"`,
      query: queries[0] ?? "",
      fn: () => scrapeHackerNews(),
    });
  }

  return tasks;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runScan(): Promise<ScanResult> {
  const profiles = await db.searchProfile.findMany({
    where: { active: true },
    include: { user: { include: { userProfile: true } } },
  });

  if (profiles.length === 0) {
    return {
      message: "No active profiles",
      profilesScanned: 0,
      fetched: 0,
      inserted: 0,
      deduped: 0,
      errors: [],
      debug: [],
    };
  }

  let totalInserted = 0;
  let totalFetched = 0;
  let totalDeduped = 0;
  const errors: string[] = [];
  const debug: string[] = [];

  for (const profile of profiles) {
    const targetRoles = profile.user.userProfile?.targetRoles ?? [];
    const queries =
      targetRoles.length > 0
        ? targetRoles
        : profile.titleIncludes.length > 0
        ? profile.titleIncludes
        : [profile.name];

    debug.push(`Profile "${profile.name}" → queries: [${queries.slice(0, 3).join(", ")}]`);

    const location = profile.locations[0] ?? "";
    const remoteOnly =
      profile.remoteTypes.includes("REMOTE") && profile.remoteTypes.length === 1;

    if (!process.env.APIFY_API_TOKEN) {
      debug.push("  LinkedIn/BuiltIn: skipped (APIFY_API_TOKEN not set)");
    }
    if (profile.linkedinSearchUrls.length > 0) {
      debug.push(`  LinkedIn search URLs: ${profile.linkedinSearchUrls.length} configured`);
    }

    // Build all tasks for this profile
    const tasks = buildScraperTasks(
      {
        sources: profile.sources as string[],
        locations: profile.locations,
        remoteTypes: profile.remoteTypes as string[],
        companyWhitelist: profile.companyWhitelist,
        rssFeeds: profile.rssFeeds,
        linkedinSearchUrls: profile.linkedinSearchUrls,
      },
      queries,
      location,
      remoteOnly
    );

    // Run all scrapers in parallel
    const settled = await Promise.allSettled(tasks.map((t) => t.fn()));

    // Insert results (can also be parallelised — skipDuplicates handles races)
    const insertPromises = settled.map(async (result, i) => {
      const { name, query } = tasks[i];
      if (result.status === "rejected") {
        errors.push(`${name}: ${String(result.reason)}`);
        return;
      }
      const raw = result.value;
      const relevant = query ? filterByQueryRelevance(raw, query) : raw;
      const filtered = filterByProfileLocations(relevant, profile.locations);
      try {
        const r = await insertNewJobs(filtered);
        totalFetched += r.fetched;
        totalInserted += r.inserted;
        totalDeduped += r.deduped;
        debug.push(`  ${name}: fetched=${r.fetched} inserted=${r.inserted} deduped=${r.deduped}`);
      } catch (err) {
        errors.push(`${name} insert: ${String(err)}`);
      }
    });

    await Promise.all(insertPromises);

    // RSS feeds — run after main scrapers (sequential OK, feeds are fast)
    if (profile.rssFeeds.length > 0) {
      try {
        const { jobs: raw, feedErrors } = await scrapeRssFeeds(profile.rssFeeds);
        const filtered = filterByProfileLocations(raw, profile.locations);
        const r = await insertNewJobs(filtered);
        totalFetched += r.fetched;
        totalInserted += r.inserted;
        totalDeduped += r.deduped;
        debug.push(
          `  RSS (${profile.rssFeeds.length} feed${profile.rssFeeds.length > 1 ? "s" : ""}): fetched=${r.fetched} inserted=${r.inserted} deduped=${r.deduped}`
        );
        for (const fe of feedErrors) errors.push(`RSS feed error: ${fe}`);
      } catch (err) {
        errors.push(`RSS error: ${String(err)}`);
      }
    }
  }

  return {
    message: "Scan complete",
    profilesScanned: profiles.length,
    fetched: totalFetched,
    inserted: totalInserted,
    deduped: totalDeduped,
    errors,
    debug,
  };
}
