import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Try to extract JobPosting schema.org data from HTML */
function extractJobPosting(html: string): {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  remoteType?: "REMOTE" | "HYBRID" | null;
} {
  // Find all JSON-LD blocks
  const jsonldBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonldBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "JobPosting") {
          const loc = typeof item.jobLocation === "object"
            ? (item.jobLocation?.address?.addressLocality ?? item.jobLocation?.address?.addressRegion ?? null)
            : null;
          const wt = (item.jobLocationType ?? "").toLowerCase();
          const remoteType = wt.includes("remote") ? "REMOTE" : wt.includes("hybrid") ? "HYBRID" : null;
          return {
            title: item.title?.trim(),
            company: (typeof item.hiringOrganization === "object" ? item.hiringOrganization?.name : item.hiringOrganization)?.trim(),
            location: loc,
            description: item.description?.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 10000),
            remoteType,
          };
        }
      }
    } catch { /* skip */ }
  }

  // Fallback: og:title / title tag
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
    ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    ?? "";

  return { title: ogTitle.trim().slice(0, 200) };
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Deduplicate by URL
  const dedupKey = `MANUAL:${parsedUrl.href.replace(/[?#].*$/, "").slice(-200)}`;
  const existing = await db.job.findUnique({ where: { dedupKey } });

  let jobId: string;

  if (existing) {
    jobId = existing.id;
  } else {
    // Fetch the page
    const res = await fetch(parsedUrl.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);

    const html = res?.ok ? await res.text().catch(() => "") : "";
    const parsed = extractJobPosting(html);

    // Build a best-effort title from URL if parsing failed
    const title = parsed.title
      || parsedUrl.hostname.replace("www.", "") + " — " + parsedUrl.pathname.split("/").filter(Boolean).slice(-2).join(" / ");

    const job = await db.job.create({
      data: {
        source: "MANUAL",
        externalId: dedupKey,
        dedupKey,
        title: title.slice(0, 200),
        company: parsed.company ?? parsedUrl.hostname.replace("www.", ""),
        location: parsed.location ?? null,
        remoteType: parsed.remoteType ?? null,
        description: parsed.description ?? "",
        requirements: [],
        applyUrl: parsedUrl.href,
        salaryMin: null,
        salaryMax: null,
        postedAt: new Date(),
      },
    });
    jobId = job.id;
  }

  // Check if application already exists
  const existingApp = await db.application.findFirst({
    where: { userId: user.id, jobId },
  });
  if (existingApp) {
    return NextResponse.json({ applicationId: existingApp.id, jobId, alreadyExists: true }, { status: 200 });
  }

  const application = await db.application.create({
    data: {
      userId: user.id,
      jobId,
      status: "PREPARED",
      fitScore: 1.0,
      fitExplanation: "Manually added job",
    },
  });

  return NextResponse.json({ applicationId: application.id, jobId }, { status: 201 });
}
