import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scrapeWttj } from "@/lib/scrapers/wttj";
import { scrapeGreenhouseMany } from "@/lib/scrapers/greenhouse";
import { scrapeLeverMany } from "@/lib/scrapers/lever";
import { insertNewJobs } from "@/lib/matching/dedup";

// Verify cron secret to protect the endpoint
function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await db.searchProfile.findMany({
    where: { active: true },
    include: { user: { include: { userProfile: true } } },
  });

  if (profiles.length === 0) {
    return NextResponse.json({ message: "No active profiles", inserted: 0 });
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
        : [profile.name]; // profile name is the last-resort (e.g. "Senior PM")

    debug.push(`Profile "${profile.name}" → queries: [${queries.slice(0, 3).join(", ")}]`);

    const location = profile.locations[0] ?? "";
    const remoteOnly = profile.remoteTypes.includes("REMOTE") && profile.remoteTypes.length === 1;

    // WTTJ (API-based, no auth needed)
    if (profile.sources.includes("WTTJ") || profile.sources.length === 0) {
      for (const query of queries.slice(0, 3)) {
        try {
          const jobs = await scrapeWttj({ query, location, remoteOnly });
          const result = await insertNewJobs(jobs);
          totalFetched += result.fetched;
          totalInserted += result.inserted;
          totalDeduped += result.deduped;
          debug.push(`  WTTJ "${query}": fetched=${result.fetched} inserted=${result.inserted} deduped=${result.deduped}`);
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
        const jobs = await scrapeGreenhouseMany(
          profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""))
        );
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
        const jobs = await scrapeLeverMany(
          profile.companyWhitelist.map((c) => c.toLowerCase().replace(/\s+/g, ""))
        );
        const result = await insertNewJobs(jobs);
        totalFetched += result.fetched;
        totalInserted += result.inserted;
        totalDeduped += result.deduped;
      } catch (err) {
        errors.push(`Lever error: ${String(err)}`);
      }
    }

    // Note: Indeed and LinkedIn scrapers use Playwright and must be run in
    // a Node.js environment with a full browser runtime (not Vercel serverless).
    // They are triggered separately via a standalone script or long-running worker.
  }

  return NextResponse.json({
    message: "Scan complete",
    profilesScanned: profiles.length,
    fetched: totalFetched,
    inserted: totalInserted,
    deduped: totalDeduped,
    errors,
    debug,
  });
}
