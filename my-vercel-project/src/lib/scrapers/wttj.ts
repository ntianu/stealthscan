import { RawJob } from "./types";

interface WttjJob {
  slug: string;
  name: string;
  contract_type?: { name?: string };
  office?: { name?: string; country?: { name?: string } };
  remote?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  profile?: string;
  company?: {
    name: string;
    slug: string;
  };
  published_at?: string;
  apply_url?: string;
}

interface WttjResponse {
  jobs: WttjJob[];
  meta?: { pagination?: { total_pages?: number } };
}

function parseRemote(remote?: string): RawJob["remoteType"] {
  if (!remote) return null;
  const r = remote.toLowerCase();
  if (r === "fulltime") return "REMOTE";
  if (r === "partial") return "HYBRID";
  if (r === "no") return "ONSITE";
  return null;
}

function extractRequirements(text: string): string[] {
  const techKeywords = [
    "python","javascript","typescript","react","next.js","node.js","graphql",
    "sql","postgresql","mysql","mongodb","redis","docker","kubernetes","aws",
    "gcp","azure","terraform","ci/cd","git","java","go","rust","ruby","php",
    "machine learning","data science","nlp","llm","product management","agile",
    "scrum","figma","sketch","swift","kotlin","flutter","react native",
  ];
  const lower = text.toLowerCase();
  return techKeywords.filter((kw) => lower.includes(kw));
}

/**
 * Scrape Welcome to the Jungle public API for jobs matching query/location.
 */
export async function scrapeWttj(params: {
  query: string;
  location?: string;
  remoteOnly?: boolean;
  maxPages?: number;
}): Promise<RawJob[]> {
  const { query, location, remoteOnly = false, maxPages = 3 } = params;
  const jobs: RawJob[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL("https://www.welcometothejungle.com/api/v2/jobs");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "30");
    if (location) url.searchParams.set("location", location);
    if (remoteOnly) url.searchParams.set("remote", "fulltime");

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US",
        },
        next: { revalidate: 0 },
      });

      if (!res.ok) break;
      const data: WttjResponse = await res.json();
      if (!data.jobs?.length) break;

      for (const j of data.jobs) {
        const description = [j.description, j.profile]
          .filter(Boolean)
          .join("\n\n");

        jobs.push({
          source: "WTTJ",
          externalId: j.slug,
          title: j.name,
          company: j.company?.name ?? "Unknown",
          location: j.office?.name ?? null,
          remoteType: parseRemote(j.remote),
          salaryMin: j.salary_min ?? null,
          salaryMax: j.salary_max ?? null,
          description,
          requirements: extractRequirements(description),
          applyUrl:
            j.apply_url ??
            `https://www.welcometothejungle.com/jobs/${j.slug}`,
          postedAt: j.published_at ? new Date(j.published_at) : null,
        });
      }

      const totalPages = data.meta?.pagination?.total_pages ?? 1;
      if (page >= totalPages) break;
    } catch {
      break;
    }
  }

  return jobs;
}
