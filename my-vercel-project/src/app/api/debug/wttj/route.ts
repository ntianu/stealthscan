import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_INDEX = "wk_cms_jobs_production";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

/**
 * GET /api/debug/wttj?q=product+manager
 * Tests the Algolia connection directly from Vercel's environment.
 */
export async function GET(req: NextRequest) {
  await requireUser();

  const query = req.nextUrl.searchParams.get("q") ?? "product manager";

  const res = await fetch(ALGOLIA_URL, {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": ALGOLIA_APP_ID,
      "X-Algolia-API-Key": ALGOLIA_API_KEY,
      "Content-Type": "application/json",
      "Referer": "https://www.welcometothejungle.com/",
      "Origin": "https://www.welcometothejungle.com",
    },
    body: JSON.stringify({ query, hitsPerPage: 5, page: 0 }),
    cache: "no-store",
  });

  const status = res.status;
  const text = await res.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const hits = Array.isArray((data as { hits?: unknown[] })?.hits)
    ? (data as { hits: { name?: string; organization?: { name?: string } }[] }).hits.map((h) => ({
        title: h.name,
        company: h.organization?.name,
      }))
    : [];

  return NextResponse.json({
    query,
    algoliaStatus: status,
    nbHits: (data as { nbHits?: number })?.nbHits ?? 0,
    hitsReturned: hits.length,
    firstFewJobs: hits,
    rawResponsePreview: typeof data === "string" ? data.slice(0, 300) : undefined,
  });
}
