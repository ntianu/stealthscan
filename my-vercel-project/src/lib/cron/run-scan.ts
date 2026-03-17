import { db } from "@/lib/db";
import { scrapeWttj } from "@/lib/scrapers/wttj";
import { scrapeGreenhouseMany } from "@/lib/scrapers/greenhouse";
import { scrapeLeverMany } from "@/lib/scrapers/lever";
import { scrapeLinkedInApify } from "@/lib/scrapers/linkedin-apify";
import { scrapeBuiltInApify } from "@/lib/scrapers/builtin-apify";
import { scrapeRemotive } from "@/lib/scrapers/remotive";
import { scrapeWwr } from "@/lib/scrapers/wwr";
import { scrapeHackerNews } from "@/lib/scrapers/hn";
import { scrapeJobicy } from "@/lib/scrapers/jobicy";
import { scrapeWorkingNomads } from "@/lib/scrapers/workingnomads";
import { scrapeRssFeeds } from "@/lib/scrapers/rss";
import { insertNewJobs } from "@/lib/matching/dedup";
import type { RawJob } from "@/lib/scrapers/types";

/** Keep only jobs whose title contains at least one meaningful word from the search query.
 *  Prevents off-topic results (e.g. Remotive returning DevOps jobs for a "Product Manager" query). */
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

/** Keep only jobs whose location overlaps a profile's target locations.
 *  Remote jobs and jobs with no location string always pass.
 *  If the profile has no locations configured, all jobs pass. */
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

/**
 * Core scan logic — runs all active search profiles against job boards.
 * Extracted so it can be called both from the cron route handler AND
 * from /api/scan directly (avoids the Vercel Deployment Protection HTTP wall).
 */
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
    // Build search queries: prefer the user's target roles, then title includes, then profile name
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

    // WTTJ (Algolia-based, no auth needed)
    if (profile.sources.includes("WTTJ") || profile.sources.length === 0) {
      for (const query of queries.slice(0, 3)) {
        try {
          const raw = await scrapeWttj({ query, location, remoteOnly });
          const relevant = filterByQueryRelevance(raw, query);
          const jobs = filterByProfileLocations(relevant, profile.locations);
          const result = await insertNewJobs(jobs);
          totalFetched += result.fetched;
          totalInserted += result.inserted;
          totalDeduped += result.deduped;
          debug.push(
            `  WTTJ "${query}": fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
          );
        } catch (err) {
          errors.push(`WTTJ error for "${query}": ${String(err)}`);
        }
      }
    }

    // Greenhouse (for whitelisted companies only)
    if (
      profile.sources.includes("GREENHOUSE") &&
      profile.companyWhitelist.length > 0
    ) {
      try {
        const raw = await scrapeGreenhouseMany(
          profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""))
        );
        const jobs = filterByProfileLocations(raw, profile.locations);
        const result = await insertNewJobs(jobs);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
      } catch (err) {
        errors.push(`Greenhouse error: ${String(err)}`);
      }
    }

    // Lever (for whitelisted companies only)
    if (
      profile.sources.includes("LEVER") &&
      profile.companyWhitelist.length > 0
    ) {
      try {
        const raw = await scrapeLeverMany(
          profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""))
        );
        const jobs = filterByProfileLocations(raw, profile.locations);
        const result = await insertNewJobs(jobs);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
      } catch (err) {
        errors.push(`Lever error: ${String(err)}`);
      }
    }

    // LinkedIn via Apify (harvestapi/linkedin-job-search — reliable, no cookies needed)
    if (profile.sources.includes("LINKEDIN") || profile.sources.length === 0) {
      if (!process.env.APIFY_API_TOKEN) {
        debug.push("  LinkedIn: skipped (APIFY_API_TOKEN not set)");
      } else {
        try {
          const raw = await scrapeLinkedInApify({
            queries: queries.slice(0, 3),
            locations: profile.locations,
            maxItemsPerQuery: 25,
            postedLimit: "week",
          });
          const relevant = filterByQueryRelevance(raw, queries[0] ?? "");
          const jobs = filterByProfileLocations(relevant, profile.locations);
          const result = await insertNewJobs(jobs);
          totalFetched += result.fetched;
          totalInserted += result.inserted;
          totalDeduped += result.deduped;
          debug.push(
            `  LinkedIn (Apify): fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
          );
        } catch (err) {
          errors.push(`LinkedIn (Apify) error: ${String(err)}`);
        }
      }
    }

    // BuiltIn via Apify (shahidirfan/BuiltIn-Jobs-Scraper — strong for NYC / major US markets)
    if (profile.sources.includes("BUILTIN") || profile.sources.length === 0) {
      if (!process.env.APIFY_API_TOKEN) {
        debug.push("  BuiltIn: skipped (APIFY_API_TOKEN not set)");
      } else {
        try {
          const primaryQuery = queries[0] ?? "";
          const primaryLocation = profile.locations[0];
          const raw = await scrapeBuiltInApify({
            keyword: primaryQuery,
            location: primaryLocation,
            maxResults: 30,
          });
          const relevant = filterByQueryRelevance(raw, primaryQuery);
          const jobs = filterByProfileLocations(relevant, profile.locations);
          const result = await insertNewJobs(jobs);
          totalFetched += result.fetched;
          totalInserted += result.inserted;
          totalDeduped += result.deduped;
          debug.push(
            `  BuiltIn (Apify): fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
          );
        } catch (err) {
          errors.push(`BuiltIn (Apify) error: ${String(err)}`);
        }
      }
    }

    // RemoteOK (free JSON API — ~100 remote jobs, engineering-heavy)
    if (profile.sources.includes("REMOTIVE") || profile.sources.length === 0) {
      for (const query of queries.slice(0, 3)) {
        try {
          const raw = await scrapeRemotive({ query });
          const relevant = filterByQueryRelevance(raw, query);
          const jobs = filterByProfileLocations(relevant, profile.locations);
          const result = await insertNewJobs(jobs);
          totalFetched += result.fetched;
          totalInserted += result.inserted;
          totalDeduped += result.deduped;
          debug.push(
            `  RemoteOK "${query}": fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
          );
        } catch (err) {
          errors.push(`RemoteOK error for "${query}": ${String(err)}`);
        }
      }
    }

    // We Work Remotely (RSS feeds, broad category coverage incl. product/design/marketing)
    if (profile.sources.includes("WEWORKREMOTELY") || profile.sources.length === 0) {
      for (const query of queries.slice(0, 3)) {
        try {
          const raw = await scrapeWwr({ query });
          const relevant = filterByQueryRelevance(raw, query);
          const jobs = filterByProfileLocations(relevant, profile.locations);
          const result = await insertNewJobs(jobs);
          totalFetched += result.fetched;
          totalInserted += result.inserted;
          totalDeduped += result.deduped;
          debug.push(
            `  WWR "${query}": fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
          );
        } catch (err) {
          errors.push(`WWR error for "${query}": ${String(err)}`);
        }
      }
    }

    // Jobicy (JSON API, US-filtered, salary data, non-engineering categories)
    if (profile.sources.includes("JOBICY") || profile.sources.length === 0) {
      try {
        const raw = await scrapeJobicy();
        const relevant = filterByQueryRelevance(raw, queries[0] ?? "");
        const jobs = filterByProfileLocations(relevant, profile.locations);
        const result = await insertNewJobs(jobs);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
        debug.push(
          `  Jobicy: fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
        );
      } catch (err) {
        errors.push(`Jobicy error: ${String(err)}`);
      }
    }

    // Working Nomads (JSON API, ~30 remote jobs, broad role coverage)
    if (profile.sources.includes("WORKINGNOMADS") || profile.sources.length === 0) {
      try {
        const raw = await scrapeWorkingNomads();
        const relevant = filterByQueryRelevance(raw, queries[0] ?? "");
        const jobs = filterByProfileLocations(relevant, profile.locations);
        const result = await insertNewJobs(jobs);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
        debug.push(
          `  WorkingNomads: fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
        );
      } catch (err) {
        errors.push(`WorkingNomads error: ${String(err)}`);
      }
    }

    // Hacker News "Who is Hiring?" — monthly thread, all role types
    // Fetched once per profile (not per query) since the thread is role-agnostic;
    // filterByQueryRelevance handles per-role narrowing after fetch.
    if (profile.sources.includes("HACKERNEWS") || profile.sources.length === 0) {
      try {
        const raw = await scrapeHackerNews();
        // Apply relevance filter for the primary query (first target role)
        const primaryQuery = queries[0] ?? "";
        const relevant = filterByQueryRelevance(raw, primaryQuery);
        const jobs = filterByProfileLocations(relevant, profile.locations);
        const result = await insertNewJobs(jobs);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
        debug.push(
          `  HN "${primaryQuery}": fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
        );
      } catch (err) {
        errors.push(`HN error: ${String(err)}`);
      }
    }

    // RSS feeds — user-provided LinkedIn job alert URLs (or any RSS job feed)
    if (profile.rssFeeds.length > 0) {
      try {
        const { jobs: raw, feedErrors } = await scrapeRssFeeds(profile.rssFeeds);
        const result = await insertNewJobs(raw);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
        debug.push(
          `  RSS (${profile.rssFeeds.length} feed${profile.rssFeeds.length > 1 ? "s" : ""}): fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`
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
