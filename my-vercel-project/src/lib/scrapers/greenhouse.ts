import { RawJob } from "./types";

interface GhJob {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url: string;
  content?: string;
  updated_at?: string;
  metadata?: Array<{ name: string; value: unknown }>;
}

interface GhResponse {
  jobs: GhJob[];
}

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","graphql","sql",
  "postgresql","mongodb","docker","kubernetes","aws","gcp","java","go",
  "rust","machine learning","data science","agile","product management",
];

function extractRequirements(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
  return TECH_KEYWORDS.filter((kw) => text.includes(kw));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function detectRemote(title: string, description: string): RawJob["remoteType"] {
  const combined = (title + " " + description).toLowerCase();
  if (combined.includes("remote")) return "REMOTE";
  if (combined.includes("hybrid")) return "HYBRID";
  return "ONSITE";
}

/**
 * Fetch all open jobs from a company's Greenhouse job board.
 * company = the Greenhouse company slug (e.g. "stripe", "airbnb")
 */
export async function scrapeGreenhouse(company: string): Promise<RawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const data: GhResponse = await res.json();
    return data.jobs.map((j) => {
      const description = stripHtml(j.content ?? "");
      return {
        source: "GREENHOUSE" as const,
        externalId: String(j.id),
        title: j.title,
        company,
        location: j.location?.name ?? null,
        remoteType: detectRemote(j.title, description),
        salaryMin: null,
        salaryMax: null,
        description,
        requirements: extractRequirements(j.content ?? ""),
        applyUrl: j.absolute_url,
        postedAt: j.updated_at ? new Date(j.updated_at) : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Scrape multiple companies at once.
 */
export async function scrapeGreenhouseMany(
  companySlugs: string[]
): Promise<RawJob[]> {
  const results = await Promise.allSettled(
    companySlugs.map((slug) => scrapeGreenhouse(slug))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<RawJob[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}
