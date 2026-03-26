/**
 * BuiltIn.com job scraper powered by Apify's shahidirfan/BuiltIn-Jobs-Scraper actor.
 * Covers 50,000+ US tech jobs across builtin.com with salary, skills, and location data.
 * Especially strong for NYC / major-market tech roles.
 *
 * Actor docs: https://apify.com/shahidirfan/BuiltIn-Jobs-Scraper
 */
import type { RawJob } from "./types";
import { extractRequirements } from "@/lib/matching/scorer";

const ACTOR_ID = "shahidirfan~BuiltIn-Jobs-Scraper";

// ─── Apify output shape (defensive) ──────────────────────────────────────────

interface ApifyBuiltInJob {
  id?: string | number;
  title?: string;
  jobTitle?: string;
  company?: string;
  companyName?: string;
  location?: string;
  salary?: string;
  salaryRange?: string;
  workplaceType?: string;
  remotePolicy?: string;
  description?: string;
  descriptionText?: string;
  url?: string;
  link?: string;
  jobUrl?: string;
  postedAt?: string;
  postedDate?: string;
  datePosted?: string;
  seniority?: string;
  skills?: string[];
  categories?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTitle(j: ApifyBuiltInJob): string {
  return (j.title ?? j.jobTitle ?? "").trim();
}

function getCompany(j: ApifyBuiltInJob): string {
  return (j.company ?? j.companyName ?? "Unknown").trim();
}

function getUrl(j: ApifyBuiltInJob): string {
  return j.url ?? j.link ?? j.jobUrl ?? "";
}

function getExternalId(j: ApifyBuiltInJob): string {
  if (j.id) return String(j.id);
  const url = getUrl(j);
  // builtin URLs: /job/company/title/123456
  const match = url.match(/\/(\d{5,})\/?$/);
  if (match) return match[1];
  return url.replace(/[^a-z0-9]/gi, "").slice(-24) || url;
}

function getPostedAt(j: ApifyBuiltInJob): Date | null {
  const raw = j.postedAt ?? j.postedDate ?? j.datePosted;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseRemote(j: ApifyBuiltInJob): RawJob["remoteType"] {
  const t = (j.workplaceType ?? j.remotePolicy ?? "").toLowerCase();
  if (t.includes("remote")) return "REMOTE";
  if (t.includes("hybrid")) return "HYBRID";
  return null;
}

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


// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeBuiltInApify(params: {
  keyword: string;
  location?: string;
  maxResults?: number;
}): Promise<RawJob[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN env var not set");

  const { keyword, location, maxResults = 30 } = params;

  const input: Record<string, unknown> = {
    keyword,
    results_wanted: maxResults,
    proxyConfiguration: { useApifyProxy: true },
  };
  if (location) input.location = location;

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
      throw new Error(`Apify BuiltIn: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }

    const items: ApifyBuiltInJob[] = await res.json();

    const jobs: RawJob[] = [];
    for (const item of items) {
      const title = getTitle(item);
      if (!title || title.length > 200) continue;
      const applyUrl = getUrl(item);
      if (!applyUrl) continue;

      const { min: salaryMin, max: salaryMax } = parseSalary(
        item.salary ?? item.salaryRange
      );

      jobs.push({
        source: "BUILTIN",
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
