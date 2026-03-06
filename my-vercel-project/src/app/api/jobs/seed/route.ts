import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scrapeWttj } from "@/lib/scrapers/wttj";
import { scrapeGreenhouseMany } from "@/lib/scrapers/greenhouse";
import { scrapeLeverMany } from "@/lib/scrapers/lever";
import { insertNewJobs } from "@/lib/matching/dedup";

/**
 * POST /api/jobs/seed
 * Authenticated endpoint (no cron secret required) to trigger a job scan
 * based on the current user's active search profiles. Useful for testing
 * and for users who want an on-demand refresh.
 */
export async function POST() {
  const user = await requireUser();

  const profiles = await db.searchProfile.findMany({
    where: { userId: user.id, active: true },
  });

  if (profiles.length === 0) {
    return NextResponse.json(
      { error: "No active search profiles. Create one first." },
      { status: 400 }
    );
  }

  let totalInserted = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    const queries =
      profile.titleIncludes.length > 0
        ? profile.titleIncludes.slice(0, 3)
        : ["software engineer"];

    const location = profile.locations[0] ?? "";
    const remoteOnly =
      profile.remoteTypes.includes("REMOTE") && profile.remoteTypes.length === 1;

    // WTTJ
    if (profile.sources.length === 0 || profile.sources.includes("WTTJ")) {
      for (const query of queries) {
        try {
          const jobs = await scrapeWttj({ query, location, remoteOnly, maxPages: 2 });
          const count = await insertNewJobs(jobs);
          totalInserted += count;
        } catch (err) {
          errors.push(`WTTJ "${query}": ${String(err)}`);
        }
      }
    }

    // Greenhouse (whitelisted companies only)
    if (
      profile.sources.includes("GREENHOUSE") &&
      profile.companyWhitelist.length > 0
    ) {
      try {
        const jobs = await scrapeGreenhouseMany(
          profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""))
        );
        const count = await insertNewJobs(jobs);
        totalInserted += count;
      } catch (err) {
        errors.push(`Greenhouse: ${String(err)}`);
      }
    }

    // Lever (whitelisted companies only)
    if (
      profile.sources.includes("LEVER") &&
      profile.companyWhitelist.length > 0
    ) {
      try {
        const jobs = await scrapeLeverMany(
          profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""))
        );
        const count = await insertNewJobs(jobs);
        totalInserted += count;
      } catch (err) {
        errors.push(`Lever: ${String(err)}`);
      }
    }
  }

  return NextResponse.json({
    message: "Seed complete",
    profilesScanned: profiles.length,
    inserted: totalInserted,
    errors,
  });
}
