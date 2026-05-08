/**
 * LinkedIn job scraper powered by Apify's harvestapi/linkedin-job-search actor.
 * No cookies or LinkedIn account required. Supports recency filters (24h, week, month).
 *
 * Actor docs: https://apify.com/harvestapi/linkedin-job-search
 */
import type { RawJob } from "./types";
import { extractRequirements } from "@/lib/matching/scorer";

const ACTOR_ID = "harvestapi~linkedin-job-search";

// ─── Apify output shape (defensive — field names vary by actor version) ───────

interface ApifyCompany {
  name?: string;
  url?: string;
  linkedinUrl?: string;
}

interface ApifyLinkedInLocation {
  linkedinText?: string;
  parsed?: { text?: string; city?: string; state?: string; country?: string };
}

interface ApifyApplyMethod {
  easyApplyUrl?: string;
  companyApplyUrl?: string;
}

interface ApifySalary {
  text?: string | null;
  min?: number | null;
  max?: number | null;
}

interface ApifyLinkedInJob {
  id?: string | number;
  jobId?: string | number;
  title?: string;
  jobTitle?: string;
  company?: ApifyCompany | string;
  companyName?: string;
  // location is an object in the actual API response
  location?: ApifyLinkedInLocation | string | null;
  postedAt?: string;
  publishedAt?: string;
  postedDate?: string;
  // salary is a nested object in the actual API response
  salary?: ApifySalary | string | null;
  salaryText?: string;
  workplaceType?: string;
  remoteType?: string;
  employmentType?: string;
  description?: string;
  descriptionText?: string;
  // actual URL fields returned by harvestapi/linkedin-job-search
  linkedinUrl?: string;
  easyApplyUrl?: string;
  applyMethod?: ApifyApplyMethod;
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

/** Return the best apply URL. Prefer external apply URL, fall back to LinkedIn URL. */
function getUrl(j: ApifyLinkedInJob): string {
  return (
    j.applyMethod?.companyApplyUrl ??
    j.applyMethod?.easyApplyUrl ??
    j.easyApplyUrl ??
    j.url ??
    j.link ??
    j.jobUrl ??
    j.applyUrl ??
    j.linkedinUrl ??
    ""
  );
}

/** Extract a human-readable location string from the nested location object. */
function getLocation(j: ApifyLinkedInJob): string | null {
  const loc = j.location;
  if (!loc) return null;
  if (typeof loc === "string") return loc || null;
  return loc.linkedinText ?? loc.parsed?.text ?? null;
}

/** Extract salary text from nested salary object or plain string field. */
function getSalaryText(j: ApifyLinkedInJob): string | undefined {
  const s = j.salary;
  if (!s) return j.salaryText;
  if (typeof s === "string") return s || undefined;
  return s.text ?? j.salaryText;
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

// ─── LinkedIn search URL parser ───────────────────────────────────────────────

/** f_TPR values LinkedIn uses (seconds since epoch offset = duration in seconds). */
function tprToPostedLimit(fTPR: string): "1h" | "24h" | "week" | "month" {
  const seconds = parseInt(fTPR.replace(/^r/, ""), 10);
  if (isNaN(seconds)) return "week";
  if (seconds <= 3600) return "1h";
  if (seconds <= 86400) return "24h";
  if (seconds <= 604800) return "week";
  return "month";
}

export interface LinkedInSearchParams {
  jobTitles: string[];
  locations: string[];
  postedLimit?: "1h" | "24h" | "week" | "month";
  workplaceType?: string[];
  employmentType?: string[];
  experienceLevel?: string[];
}

/** Parse a LinkedIn jobs search URL into Apify actor input params. */
export function parseLinkedInSearchUrl(url: string): LinkedInSearchParams | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("linkedin.com")) return null;

    const keywords = parsed.searchParams.get("keywords") ?? "";
    const location = parsed.searchParams.get("location") ?? "";
    const fTPR = parsed.searchParams.get("f_TPR");
    const fWT = parsed.searchParams.get("f_WT");
    const fJT = parsed.searchParams.get("f_JT");
    const fE = parsed.searchParams.get("f_E");

    const wtMap: Record<string, string> = { "1": "office", "2": "remote", "3": "hybrid" };
    const jtMap: Record<string, string> = {
      F: "full-time", P: "part-time", C: "contract", T: "temporary", I: "internship",
    };
    const elMap: Record<string, string> = {
      "1": "internship", "2": "entry", "3": "associate",
      "4": "mid-senior", "5": "director", "6": "executive",
    };

    return {
      jobTitles: keywords ? [keywords] : [],
      locations: location ? [location] : [],
      postedLimit: fTPR ? tprToPostedLimit(fTPR) : undefined,
      workplaceType: fWT ? fWT.split(",").map((v) => wtMap[v]).filter(Boolean) : undefined,
      employmentType: fJT ? fJT.split(",").map((v) => jtMap[v]).filter(Boolean) : undefined,
      experienceLevel: fE ? fE.split(",").map((v) => elMap[v]).filter(Boolean) : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeLinkedInApify(params: {
  queries: string[];
  locations: string[];
  maxItemsPerQuery?: number;
  postedLimit?: "1h" | "24h" | "week" | "month";
  workplaceType?: string[];
  employmentType?: string[];
  experienceLevel?: string[];
}): Promise<RawJob[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN env var not set");

  const {
    queries,
    locations,
    maxItemsPerQuery = 50,
    postedLimit = "week",
    workplaceType,
    employmentType,
    experienceLevel,
  } = params;

  const input: Record<string, unknown> = {
    jobTitles: queries.slice(0, 5),
    locations: locations.length > 0 ? locations : ["United States"],
    maxItems: maxItemsPerQuery,
    postedLimit,
    sortBy: "date",
  };
  if (workplaceType?.length) input.workplaceType = workplaceType;
  if (employmentType?.length) input.employmentType = employmentType;
  if (experienceLevel?.length) input.experienceLevel = experienceLevel;

  // run-sync-get-dataset-items blocks until the actor completes (max 300s)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100_000);

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=90`,
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
      // Use linkedinUrl as guaranteed fallback — every item has it
      const applyUrl = getUrl(item) || item.linkedinUrl || "";
      if (!applyUrl) continue;

      const { min: salaryMin, max: salaryMax } = parseSalary(getSalaryText(item));

      jobs.push({
        source: "LINKEDIN",
        externalId: getExternalId(item),
        title,
        company: getCompany(item),
        location: getLocation(item),
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
