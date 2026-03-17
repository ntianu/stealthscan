/**
 * LinkedIn job scraper powered by Apify's harvestapi/linkedin-job-search actor.
 * No cookies or LinkedIn account required. Supports recency filters (24h, week, month).
 *
 * Actor docs: https://apify.com/harvestapi/linkedin-job-search
 */
import type { RawJob } from "./types";

const ACTOR_ID = "harvestapi~linkedin-job-search";

// ─── Apify output shape (defensive — field names vary by actor version) ───────

interface ApifyCompany {
  name?: string;
  url?: string;
}

interface ApifyLinkedInJob {
  id?: string | number;
  jobId?: string | number;
  title?: string;
  jobTitle?: string;
  company?: ApifyCompany | string;
  companyName?: string;
  location?: string;
  postedAt?: string;
  publishedAt?: string;
  postedDate?: string;
  salary?: string;
  salaryText?: string;
  workplaceType?: string;
  remoteType?: string;
  employmentType?: string;
  description?: string;
  descriptionText?: string;
  url?: string;
  link?: string;
  jobUrl?: string;
  applyUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTitle(j: ApifyLinkedInJob): string {
  return (j.title ?? j.jobTitle ?? "").trim();
}

function getCompany(j: ApifyLinkedInJob): string {
  const c = j.company;
  if (typeof c === "string") return c.trim();
  if (c?.name) return c.name.trim();
  return (j.companyName ?? "Unknown").trim();
}

function getUrl(j: ApifyLinkedInJob): string {
  return j.url ?? j.link ?? j.jobUrl ?? j.applyUrl ?? "";
}

function getExternalId(j: ApifyLinkedInJob): string {
  const raw = j.id ?? j.jobId;
  if (raw) return String(raw);
  const url = getUrl(j);
  const match = url.match(/\/jobs\/view\/(\d+)/);
  if (match) return match[1];
  return url.replace(/[^a-z0-9]/gi, "").slice(-24) || url;
}

function getPostedAt(j: ApifyLinkedInJob): Date | null {
  const raw = j.postedAt ?? j.publishedAt ?? j.postedDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseRemote(j: ApifyLinkedInJob): RawJob["remoteType"] {
  const t = (j.workplaceType ?? j.remoteType ?? "").toLowerCase();
  if (t.includes("remote")) return "REMOTE";
  if (t.includes("hybrid")) return "HYBRID";
  return null;
}

/** Parse "$150,000 - $200,000" or "150k–200k" → { min, max } in whole dollars. */
function parseSalary(raw: string | undefined): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const nums = [...raw.matchAll(/[\d,]+k?/gi)].map((m) => {
    const s = m[0].replace(/,/g, "").toLowerCase();
    return s.endsWith("k") ? parseInt(s) * 1000 : parseInt(s);
  }).filter((n) => !isNaN(n) && n > 0);

  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return { min: nums[0], max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function extractRequirements(description: string): string[] {
  const KEYWORDS = [
    "python","javascript","typescript","react","node.js","sql","postgresql",
    "mongodb","docker","kubernetes","aws","gcp","azure","java","go","rust",
    "machine learning","data science","agile","product management","figma",
    "swift","kotlin","ruby","php","graphql","redis","terraform","ci/cd",
    "llm","ai","ml","analytics","sql","tableau","looker","dbt","snowflake",
  ];
  const lower = description.toLowerCase();
  return KEYWORDS.filter((kw) => lower.includes(kw));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeLinkedInApify(params: {
  queries: string[];
  locations: string[];
  maxItemsPerQuery?: number;
  postedLimit?: "1h" | "24h" | "week" | "month";
}): Promise<RawJob[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN env var not set");

  const { queries, locations, maxItemsPerQuery = 25, postedLimit = "week" } = params;

  const input = {
    jobTitles: queries.slice(0, 5),  // cap to avoid excessive costs
    locations: locations.length > 0 ? locations : ["United States"],
    maxItems: maxItemsPerQuery,
    postedLimit,
    sortBy: "date",
  };

  // run-sync-get-dataset-items blocks until the actor completes (max 300s)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=85`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Apify LinkedIn: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }

    const items: ApifyLinkedInJob[] = await res.json();

    const jobs: RawJob[] = [];
    for (const item of items) {
      const title = getTitle(item);
      if (!title || title.length > 200) continue;
      const applyUrl = getUrl(item);
      if (!applyUrl) continue;

      const { min: salaryMin, max: salaryMax } = parseSalary(
        item.salary ?? item.salaryText
      );

      jobs.push({
        source: "LINKEDIN",
        externalId: getExternalId(item),
        title,
        company: getCompany(item),
        location: item.location ?? null,
        remoteType: parseRemote(item),
        salaryMin,
        salaryMax,
        description: item.description ?? item.descriptionText ?? "",
        requirements: extractRequirements(item.description ?? item.descriptionText ?? ""),
        applyUrl,
        postedAt: getPostedAt(item),
      });
    }

    return jobs;
  } finally {
    clearTimeout(timer);
  }
}
