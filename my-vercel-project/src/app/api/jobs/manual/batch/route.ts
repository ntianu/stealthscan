import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreJob } from "@/lib/matching/scorer";
import { selectBestResume } from "@/lib/ai/resume-select";
import type { UserProfile, SearchProfile, Resume, Seniority } from "@prisma/client";

/** Maximum URLs accepted per batch request */
const MAX_URLS = 20;
/** Number of URLs fetched in parallel */
const CONCURRENCY = 3;
/** Per-URL fetch timeout (ms) */
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IngestResultAdded = {
  url: string;
  status: "added";
  applicationId: string;
  jobId: string;
  title: string;
  company: string;
};

type IngestResultExists = {
  url: string;
  status: "exists";
  applicationId: string;
  jobId: string;
  title: string;
  company: string;
};

type IngestResultFailed = {
  url: string;
  status: "failed" | "invalid";
  error: string;
};

type IngestResult = IngestResultAdded | IngestResultExists | IngestResultFailed;

type ScoringCtx = {
  userProfile: UserProfile | null;
  searchProfiles: SearchProfile[];
  resumes: Resume[];
  uniqueSeniorities: Seniority[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract JobPosting schema.org data from HTML (mirrors the single-URL route logic) */
function extractJobPosting(html: string): {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  remoteType?: "REMOTE" | "HYBRID" | null;
} {
  const jsonldBlocks = [
    ...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const block of jsonldBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "JobPosting") {
          const loc =
            typeof item.jobLocation === "object"
              ? (item.jobLocation?.address?.addressLocality ??
                  item.jobLocation?.address?.addressRegion ??
                  null)
              : null;
          const wt = (item.jobLocationType ?? "").toLowerCase();
          const remoteType = wt.includes("remote")
            ? "REMOTE"
            : wt.includes("hybrid")
              ? "HYBRID"
              : null;
          return {
            title: item.title?.trim(),
            company: (
              typeof item.hiringOrganization === "object"
                ? item.hiringOrganization?.name
                : item.hiringOrganization
            )?.trim(),
            location: loc,
            description: item.description
              ?.replace(/<[^>]+>/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim()
              .slice(0, 10000),
            remoteType,
          };
        }
      }
    } catch {
      /* skip malformed JSON-LD */
    }
  }

  // Fallback: og:title or <title>
  const ogTitle =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
    "";

  return { title: ogTitle.trim().slice(0, 200) };
}

/**
 * Ingest a single URL: fetch HTML, extract job, dedup, create Job + Application.
 * Uses the scoring context loaded once for the whole batch.
 */
async function ingestOne(
  rawUrl: string,
  userId: string,
  ctx: ScoringCtx
): Promise<IngestResult> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { url: rawUrl, status: "invalid", error: "Invalid URL" };
  }

  const dedupKey = `MANUAL:${parsedUrl.href.replace(/[?#].*$/, "").slice(-200)}`;

  try {
    // Check if this job already exists
    const existingJob = await db.job.findUnique({ where: { dedupKey } });

    let jobId: string;
    let title: string;
    let company: string;

    if (existingJob) {
      jobId = existingJob.id;
      title = existingJob.title;
      company = existingJob.company;
    } else {
      // Fetch the job page
      const res = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }).catch(() => null);

      const html = res?.ok ? await res.text().catch(() => "") : "";
      const parsed = extractJobPosting(html);

      const resolvedTitle =
        parsed.title ||
        parsedUrl.hostname.replace("www.", "") +
          " — " +
          parsedUrl.pathname.split("/").filter(Boolean).slice(-2).join(" / ");

      const resolvedCompany =
        parsed.company ?? parsedUrl.hostname.replace("www.", "");

      const job = await db.job.create({
        data: {
          source: "MANUAL",
          externalId: dedupKey,
          dedupKey,
          title: resolvedTitle.slice(0, 200),
          company: resolvedCompany,
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
      title = job.title;
      company = job.company;
    }

    // Check if user already has an application for this job
    const existingApp = await db.application.findFirst({
      where: { userId, jobId },
    });

    if (existingApp) {
      return {
        url: rawUrl,
        status: "exists",
        applicationId: existingApp.id,
        jobId,
        title,
        company,
      };
    }

    // Build a job-like object for scoring (needed whether job was just created or already existed)
    const jobForScore = existingJob ?? (await db.job.findUnique({ where: { id: jobId } }));

    // Compute fit score using scoring context loaded once for the batch
    const fitResult =
      ctx.userProfile && jobForScore
        ? scoreJob(jobForScore, ctx.userProfile, ctx.uniqueSeniorities)
        : { score: 1.0, explanation: "Manually added job", matchedSkills: [], missedSkills: [] };

    // Select best resume for this specific job
    const bestResume =
      ctx.resumes.length > 0 && jobForScore
        ? selectBestResume(ctx.resumes, jobForScore)
        : null;

    const application = await db.application.create({
      data: {
        userId,
        jobId,
        resumeId: bestResume?.id ?? null,
        status: "PREPARED",
        fitScore: fitResult.score,
        fitExplanation: fitResult.explanation,
      },
    });

    return {
      url: rawUrl,
      status: "added",
      applicationId: application.id,
      jobId,
      title,
      company,
    };
  } catch (err) {
    console.error("[batch-ingest] failed for", rawUrl, err);
    return {
      url: rawUrl,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).urls)
  ) {
    return NextResponse.json({ error: "urls array required" }, { status: 400 });
  }

  const rawUrls = (body as { urls: unknown[] }).urls;
  if (rawUrls.length === 0) {
    return NextResponse.json({ error: "urls array is empty" }, { status: 400 });
  }

  // Sanitise: string-only, trim, deduplicate, cap at MAX_URLS
  const urls = [
    ...new Set(
      rawUrls
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_URLS);

  if (urls.length === 0) {
    return NextResponse.json({ error: "No valid URLs provided" }, { status: 400 });
  }

  // Load scoring context once for the whole batch
  const [userProfile, searchProfiles, resumes] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.searchProfile.findMany({ where: { userId: user.id, active: true } }),
    db.resume.findMany({ where: { userId: user.id, active: true } }),
  ]);

  const uniqueSeniorities: Seniority[] = [
    ...new Set(searchProfiles.flatMap((p) => p.seniority as Seniority[])),
  ];

  const ctx: ScoringCtx = { userProfile, searchProfiles, resumes, uniqueSeniorities };

  // Process in chunks of CONCURRENCY to avoid hammering external sites
  const results: IngestResult[] = [];

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((url) => ingestOne(url, user.id, ctx))
    );
    for (let j = 0; j < chunk.length; j++) {
      const r = settled[j];
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        results.push({
          url: chunk[j],
          status: "failed",
          error: r.reason instanceof Error ? r.reason.message : "Unknown error",
        });
      }
    }
  }

  const counts = {
    added: results.filter((r) => r.status === "added").length,
    exists: results.filter((r) => r.status === "exists").length,
    failed: results.filter((r) => r.status === "failed" || r.status === "invalid").length,
  };

  return NextResponse.json({ results, counts }, { status: 200 });
}
