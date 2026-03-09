/**
 * Hacker News "Who is Hiring?" scraper.
 * Uses the Algolia HN Search API to fetch the current monthly thread,
 * then parses top-level job comments into RawJob records.
 *
 * The monthly thread changes every first weekday — no stale dedup issues.
 * Covers all role types: engineering, product, design, marketing, etc.
 */
import { RawJob } from "./types";

const ALGOLIA_BASE = "https://hn.algolia.com/api/v1";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","sketch","swift",
  "kotlin","ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];

function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Strip HTML tags and decode common entities. */
function cleanHtml(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]+)"[^>]*>.*?<\/a>/gi, "$1")
    .replace(/<p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface AlgoliaComment {
  objectID: string;
  comment_text: string | null;
  parent_id: number | string;
  story_id: number | string;
  created_at: string;
}

interface AlgoliaSearchResponse {
  hits: AlgoliaComment[];
  nbHits: number;
  nbPages: number;
}

/** Parse a single HN job comment into a RawJob. Returns null if unparseable. */
function parseComment(
  rawHtml: string,
  commentId: string,
  createdAt: string
): RawJob | null {
  if (!rawHtml) return null;

  const text = cleanHtml(rawHtml);
  if (text.length < 30) return null;

  // Find the first http/https URL in the text for the apply link
  const urlMatch = text.match(/https?:\/\/[^\s<>"')[\]]+/);
  const applyUrl =
    urlMatch?.[0] ?? `https://news.ycombinator.com/item?id=${commentId}`;

  const isRemote = /\bremote\b|\bwfh\b|\banywhere\b/i.test(text);

  const salaryMatch = text.match(/\$(\d{2,3})k(?:\s*[-–]\s*\$?(\d{2,3})k)?/i);
  const salaryMin = salaryMatch ? parseInt(salaryMatch[1]) * 1000 : null;
  const salaryMax = salaryMatch?.[2] ? parseInt(salaryMatch[2]) * 1000 : null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";

  // ── Format A: pipe-delimited "Company | Role | Location | ..." ──────────
  if (firstLine.includes("|")) {
    const segs = firstLine.split("|").map((s) => s.trim()).filter(Boolean);
    if (segs.length >= 2) {
      // Strip batch tags like "(YC W24)" or "(YC, CI/CD for DevOps)"
      const company = segs[0].replace(/\s*\([^)]*\)\s*/g, "").trim();
      const title = segs[1];
      // Location: first segment that doesn't look like salary/type/URL
      const locationSeg =
        segs.slice(2).find(
          (s) =>
            !/^\$|salary|equity|full.?time|part.?time|contract|remote|onsite|https?/i.test(s)
        ) ?? null;

      if (company && title && company.length <= 100 && title.length <= 150) {
        return {
          source: "HACKERNEWS" as const,
          externalId: commentId,
          title,
          company,
          location: isRemote ? null : locationSeg,
          remoteType: isRemote ? "REMOTE" as const : null,
          salaryMin,
          salaryMax,
          description: text,
          requirements: extractRequirements(text),
          applyUrl,
          postedAt: createdAt ? new Date(createdAt) : null,
        };
      }
    }
  }

  // ── Format B: key-value "Title: X\nCompany: Y\nLocation: Z" ─────────────
  const titleKv = text.match(/\bTitle\s*:\s*([^\n|]+)/i)?.[1]?.trim();
  const companyKv = text.match(/\bCompany\s*:\s*([^\n|]+)/i)?.[1]?.trim();
  if (titleKv && companyKv && titleKv.length <= 200 && companyKv.length <= 100) {
    const locationKv =
      text.match(/\bLocation\s*:\s*([^\n|]+)/i)?.[1]?.trim() ?? null;
    return {
      source: "HACKERNEWS" as const,
      externalId: commentId,
      title: titleKv,
      company: companyKv,
      location: isRemote ? null : locationKv,
      remoteType: isRemote ? "REMOTE" as const : null,
      salaryMin,
      salaryMax,
      description: text,
      requirements: extractRequirements(text),
      applyUrl,
      postedAt: createdAt ? new Date(createdAt) : null,
    };
  }

  return null; // Prose-only posts — skip, unparseable reliably
}

export async function scrapeHackerNews(): Promise<RawJob[]> {
  try {
    // ── Step 1: Get the latest "Who is Hiring?" story ID ────────────────
    const storyRes = await fetch(
      `${ALGOLIA_BASE}/search_by_date?query=Ask+HN%3A+Who+is+hiring%3F&tags=ask_hn&hitsPerPage=1`,
      { cache: "no-store" }
    );
    if (!storyRes.ok) return [];

    const storyData = await storyRes.json();
    const storyId = storyData.hits?.[0]?.objectID;
    if (!storyId) return [];

    // ── Step 2: Fetch all top-level job comments (2 pages × 200 = 400) ──
    const jobs: RawJob[] = [];
    const maxPages = 2;

    for (let page = 0; page < maxPages; page++) {
      const commentsRes = await fetch(
        `${ALGOLIA_BASE}/search?tags=comment,story_${storyId}&hitsPerPage=200&page=${page}`,
        { cache: "no-store" }
      );
      if (!commentsRes.ok) break;

      const data: AlgoliaSearchResponse = await commentsRes.json();
      if (!data.hits?.length) break;

      for (const hit of data.hits) {
        // Only top-level job posts: parent is the story itself
        if (String(hit.parent_id) !== String(storyId)) continue;
        if (!hit.comment_text) continue;

        const job = parseComment(
          hit.comment_text,
          hit.objectID,
          hit.created_at
        );
        if (job) jobs.push(job);
      }

      if (page >= data.nbPages - 1) break;
    }

    return jobs;
  } catch {
    return [];
  }
}
