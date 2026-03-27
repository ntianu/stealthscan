import { RawJob } from "./types";

interface LeverJob {
  id: string;
  text: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  description?: string;
  descriptionPlain?: string;
  lists?: Array<{ text: string; content: string }>;
  hostedUrl: string;
  applyUrl: string;
  createdAt?: number;
}

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","graphql","sql",
  "postgresql","mongodb","docker","kubernetes","aws","gcp","java","go",
  "rust","machine learning","data science","agile","product management",
];

function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw));
}

function detectRemote(title: string, categories?: LeverJob["categories"]): RawJob["remoteType"] {
  const locationText = (categories?.location ?? "").toLowerCase();
  const commitmentText = (categories?.commitment ?? "").toLowerCase();
  if (locationText.includes("remote") || commitmentText.includes("remote")) return "REMOTE";
  if (locationText.includes("hybrid") || commitmentText.includes("hybrid")) return "HYBRID";
  return "ONSITE";
}

/**
 * Fetch all open jobs from a company's Lever job board.
 */
export async function scrapeLever(company: string): Promise<RawJob[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const data: LeverJob[] = await res.json();
    return data.map((j) => {
      const description =
        j.descriptionPlain ??
        (j.description ?? "").replace(/<[^>]+>/g, " ").trim();
      const listText = (j.lists ?? []).map((l) => l.content).join(" ");
      const fullText = `${description} ${listText}`;

      return {
        source: "LEVER" as const,
        externalId: j.id,
        title: j.text,
        company,
        location: j.categories?.location ?? null,
        remoteType: detectRemote(j.text, j.categories),
        salaryMin: null,
        salaryMax: null,
        description: fullText,
        requirements: extractRequirements(fullText),
        applyUrl: j.applyUrl ?? j.hostedUrl,
        postedAt: j.createdAt ? new Date(j.createdAt) : null,
      };
    });
  } catch {
    return [];
  }
}

export async function scrapeLeverMany(companySlugs: string[]): Promise<RawJob[]> {
  const results = await Promise.allSettled(
    companySlugs.map((slug) => scrapeLever(slug))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<RawJob[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}
