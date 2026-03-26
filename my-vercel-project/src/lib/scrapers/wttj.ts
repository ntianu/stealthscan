import { RawJob } from "./types";

// WTTJ uses Algolia for job search (public read-only credentials)
const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_INDEX = "wk_cms_jobs_production";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

interface AlgoliaHit {
  objectID: string;
  slug: string;
  name: string;
  reference?: string;
  profile?: string;
  published_at?: string;
  remote?: string;
  contract_type?: string;
  salary_minimum?: number | null;
  salary_maximum?: number | null;
  salary_yearly_minimum?: number | null;
  salary_yearly_maximum?: number | null;
  organization?: {
    name?: string;
    slug?: string;
  };
  office?: { city?: string; country?: { name?: string } };
  offices?: Array<{ city?: string; country?: { name?: string } }>;
  sectors?: Array<{ name?: string }>;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbPages: number;
  page: number;
}

function parseRemote(remote?: string): RawJob["remoteType"] {
  if (!remote) return null;
  const r = remote.toLowerCase();
  if (r === "fulltime") return "REMOTE";
  if (r === "partial") return "HYBRID";
  if (r === "no") return "ONSITE";
  return null;
}


function getLocation(hit: AlgoliaHit): string | null {
  const off = hit.office ?? hit.offices?.[0];
  if (!off) return null;
  return [off.city, off.country?.name].filter(Boolean).join(", ") || null;
}

/**
 * Scrape Welcome to the Jungle via their Algolia search index.
 */
export async function scrapeWttj(params: {
  query: string;
  location?: string;
  remoteOnly?: boolean;
  maxPages?: number;
}): Promise<RawJob[]> {
  const { query, location, remoteOnly = false, maxPages = 3 } = params;
  const jobs: RawJob[] = [];

  // Build facet filters: remote filter and/or city filter
  // office.city:CITY is the working Algolia facet (country-level filter returns 0 results)
  const facetFilters: string[][] = [];
  if (remoteOnly) {
    facetFilters.push(["remote:fulltime"]);
  } else if (location) {
    // Extract just the city name (drop country suffix like ", US" or ", France")
    const city = location.split(",")[0].trim();
    // Include both remote jobs AND jobs in the target city
    facetFilters.push([`remote:fulltime`, `office.city:${city}`]);
  }

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      query,
      hitsPerPage: 30,
      page,
    };

    if (facetFilters.length > 0) {
      body.facetFilters = facetFilters;
    }

    try {
      const res = await fetch(ALGOLIA_URL, {
        method: "POST",
        headers: {
          "X-Algolia-Application-Id": ALGOLIA_APP_ID,
          "X-Algolia-API-Key": ALGOLIA_API_KEY,
          "Content-Type": "application/json",
          // Required: Algolia key is referer-restricted to WTTJ's domain
          "Referer": "https://www.welcometothejungle.com/",
          "Origin": "https://www.welcometothejungle.com",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Algolia returned ${res.status}: ${await res.text()}`);
      }
      const data: AlgoliaResponse = await res.json();
      if (!data.hits?.length) break;

      for (const hit of data.hits) {
        const orgSlug = hit.organization?.slug ?? "";
        const applyUrl = `https://www.welcometothejungle.com/companies/${orgSlug}/jobs/${hit.slug}`;
        const description = hit.profile ?? "";

        const salaryMin = hit.salary_yearly_minimum ?? hit.salary_minimum ?? null;
        const salaryMax = hit.salary_yearly_maximum ?? hit.salary_maximum ?? null;

        jobs.push({
          source: "WTTJ",
          externalId: hit.reference ?? hit.objectID,
          title: hit.name,
          company: hit.organization?.name ?? "Unknown",
          location: getLocation(hit),
          remoteType: parseRemote(hit.remote),
          salaryMin: salaryMin ? Math.round(salaryMin) : null,
          salaryMax: salaryMax ? Math.round(salaryMax) : null,
          description,
          requirements: extractRequirements(description),
          applyUrl,
          postedAt: hit.published_at ? new Date(hit.published_at) : null,
        });
      }

      if (page >= data.nbPages - 1) break;
    } catch (err) {
      // Re-throw so the caller can log the error properly
      throw err;
    }
  }

  return jobs;
}
