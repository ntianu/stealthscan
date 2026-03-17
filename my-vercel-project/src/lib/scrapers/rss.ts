/**
 * Generic RSS job feed parser.
 * Handles LinkedIn job alert RSS feeds and other standard RSS job feeds.
 *
 * LinkedIn alert RSS format:
 *   <title>Senior Product Manager at Stripe</title>
 *   <link>https://www.linkedin.com/jobs/view/4199414033</link>
 *   <pubDate>Mon, 09 Mar 2026 12:00:00 GMT</pubDate>
 *
 * User provides RSS URLs from: LinkedIn job alerts, Google alerts, etc.
 */
import { RawJob } from "./types";

const TECH_KEYWORDS = [
  "python","javascript","typescript","react","node.js","sql","postgresql",
  "mongodb","docker","kubernetes","aws","gcp","java","go","machine learning",
  "data science","agile","product management","figma","swift","kotlin",
  "ruby","php","graphql","redis","terraform","ci/cd","flutter","rust",
];

function extractText(tag: string, xml: string): string {
  const m =
    xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ??
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw));
}

function detectRemote(text: string): RawJob["remoteType"] {
  const t = text.toLowerCase();
  if (t.includes("remote")) return "REMOTE";
  if (t.includes("hybrid")) return "HYBRID";
  return null;
}

/** Parse "Job Title at Company Name" → { title, company }.
 *  Falls back to full string as title if no " at " pattern. */
function parseJobTitle(raw: string): { title: string; company: string } {
  const cleaned = stripHtml(raw);
  // LinkedIn format: "Title at Company - Location" or "Title at Company"
  const atIdx = cleaned.lastIndexOf(" at ");
  if (atIdx > 0) {
    const company = cleaned.slice(atIdx + 4).split(" - ")[0].trim();
    return { title: cleaned.slice(0, atIdx).trim(), company };
  }
  // "Company: Title" format
  const colonIdx = cleaned.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 50) {
    return {
      title: cleaned.slice(colonIdx + 2).trim(),
      company: cleaned.slice(0, colonIdx).trim(),
    };
  }
  return { title: cleaned, company: "Unknown" };
}

/** Extract a stable external ID from a URL or GUID. */
function extractId(link: string, guid: string): string {
  // LinkedIn job ID: /jobs/view/1234567890
  const liMatch = (link || guid).match(/\/jobs\/view\/(\d+)/);
  if (liMatch) return liMatch[1];
  // Generic: use the last path segment
  const parts = (link || guid).replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || link || guid;
}

/** Fetch and parse a single RSS feed URL into RawJob[]. */
export async function fetchRssFeed(feedUrl: string): Promise<RawJob[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScanBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const itemBlocks = xml.split(/<item[\s>]/).slice(1);
    if (!itemBlocks.length) return [];

    const jobs: RawJob[] = [];
    for (const block of itemBlocks) {
      const rawTitle = extractText("title", block);
      if (!rawTitle) continue;

      const { title, company } = parseJobTitle(rawTitle);
      if (!title || title.length > 200) continue;

      const link = extractText("link", block) ||
        block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim() || "";
      const guid = extractText("guid", block);
      const description = stripHtml(extractText("description", block));
      const pubDate = extractText("pubDate", block) || extractText("published", block);
      const externalId = extractId(link, guid);
      const applyUrl = link || guid;

      if (!applyUrl) continue;

      const remoteType = detectRemote(rawTitle + " " + description);

      jobs.push({
        source: "RSS" as const,
        externalId,
        title,
        company,
        location: null, // RSS rarely includes structured location
        remoteType,
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

/** Fetch all RSS feeds for a profile and return combined RawJob[].
 *  Errors from individual feeds are thrown so the caller can surface them. */
export async function scrapeRssFeeds(
  feedUrls: string[]
): Promise<{ jobs: RawJob[]; feedErrors: string[] }> {
  if (!feedUrls.length) return { jobs: [], feedErrors: [] };

  const settled = await Promise.allSettled(feedUrls.map(fetchRssFeed));
  const jobs: RawJob[] = [];
  const feedErrors: string[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    } else {
      const short = feedUrls[i].replace(/[?#].*$/, "").slice(-60);
      feedErrors.push(`Feed …${short}: ${String(result.reason)}`);
    }
  });

  return { jobs, feedErrors };
}
