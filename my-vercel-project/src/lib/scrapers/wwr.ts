/**
 * We Work Remotely scraper — free public RSS feeds, broad category coverage.
 * Categories: product, design, marketing, sales, programming, data, devops, finance, support, management.
 * No authentication required.
 */
import { RawJob } from "./types";
import { extractRequirements } from "@/lib/matching/scorer";

const BASE = "https://weworkremotely.com/categories";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","sketch","swift",
  "kotlin","ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];

/** Map a freeform query string to the most relevant WWR RSS category slug. */
function queryToCategory(query: string): string {
  const q = query.toLowerCase();
  if (/\bproduct\b|product manager|product owner|pm\b/.test(q)) return "remote-product-jobs";
  if (/design|ux|ui\b|figma|sketch|illustrat/.test(q)) return "remote-design-jobs";
  if (/marketing|growth|seo|content|copywrite|brand/.test(q)) return "remote-marketing-jobs";
  if (/\bsales\b|account exec|business dev|revenue|bdr|sdr/.test(q)) return "remote-sales-jobs";
  if (/data|analyst|analytics|scientist|science|bi\b|tableau/.test(q)) return "remote-data-science-jobs";
  if (/devops|infra|sre|cloud|platform|reliability/.test(q)) return "remote-devops-sysadmin-jobs";
  if (/finance|legal|accounting|counsel|compliance|controller/.test(q)) return "remote-finance-legal-jobs";
  if (/support|customer success|customer service|cx\b/.test(q)) return "remote-customer-support-jobs";
  if (/director|vp\b|head of|chief|cto|cpo|svp/.test(q)) return "remote-management-executive-jobs";
  if (/engineer|developer|software|backend|frontend|fullstack|full.stack/.test(q)) return "remote-programming-jobs";
  return "remote-all-other-jobs";
}

function extractText(tag: string, xml: string): string {
  const m =
    xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ??
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}


/** Parse "Category: Job Title at Company Name" → { title, company } */
function parseTitle(raw: string): { title: string; company: string } {
  // Strip the leading "Category: " prefix if present
  const withoutCat = raw.replace(/^[^:]+:\s*/, "");
  // Split on " at " (last occurrence to handle company names with "at" in them)
  const atIdx = withoutCat.lastIndexOf(" at ");
  if (atIdx > 0) {
    return {
      title: withoutCat.slice(0, atIdx).trim(),
      company: withoutCat.slice(atIdx + 4).trim(),
    };
  }
  return { title: withoutCat.trim(), company: "Unknown" };
}

export async function scrapeWwr(params: { query: string }): Promise<RawJob[]> {
  const { query } = params;
  const category = queryToCategory(query);
  const url = `${BASE}/${category}.rss`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScanBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const xml = await res.text();

    // Split on <item> blocks
    const itemMatches = xml.split(/<item>/).slice(1);
    if (!itemMatches.length) return [];

    const jobs: RawJob[] = [];
    for (const block of itemMatches) {
      const rawTitle = extractText("title", block);
      if (!rawTitle) continue;

      const { title, company } = parseTitle(rawTitle);
      const link = extractText("link", block) || block.match(/<link>([^<]+)<\/link>/)?.[1] || "";
      const description = extractText("description", block);
      const pubDate = extractText("pub_date", block) || extractText("pubDate", block);
      const applyUrl = extractText("apply_url", block) || link;

      // Extract ID from URL slug
      const idMatch = link.match(/\/(\d+)[^/]*$/);
      const externalId = idMatch ? idMatch[1] : link;

      if (!title || !applyUrl) continue;

      jobs.push({
        source: "WEWORKREMOTELY" as const,
        externalId,
        title,
        company,
        location: null, // WWR is remote-only
        remoteType: "REMOTE" as const,
        salaryMin: null,
        salaryMax: null,
        description,
        requirements: extractRequirements(description),
        applyUrl,
        postedAt: pubDate ? new Date(pubDate) : null,
      });
    }

    return jobs;
  } catch {
    return [];
  }
}
