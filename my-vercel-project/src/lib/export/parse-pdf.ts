/**
 * Parse a PDF master resume into a ResumeStructure.
 *
 * Strategy:
 *   1. Extract plain text via pdf-parse.
 *   2. Split into lines, drop empty lines but remember blank-line boundaries.
 *   3. Pull the contact block from the top until we hit the first section heading.
 *   4. Detect section headings using a fuzzy match against known names.
 *   5. Parse each section with a section-specific heuristic.
 *
 * This is intentionally heuristic — perfect parsing isn't possible from free-form
 * PDFs without layout info. We aim for "good enough that the merger and renderer
 * can produce a usable output, with degraded fidelity flagged in parseWarnings."
 */

// pdf-parse's index.js auto-runs a test on import; import the lib file directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buffer: Buffer
) => Promise<{ text: string; numpages: number; info: unknown }>;

import type {
  ContactBlock,
  EducationItem,
  ExperienceItem,
  OtherSection,
  ResumeStructure,
  SkillGroup,
} from "./types";

// ─── Section heading detection ──────────────────────────────────────────────

const SECTION_ALIASES: Record<string, string[]> = {
  summary: ["summary", "profile", "about", "about me", "objective", "professional summary"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history",
    "career",
  ],
  education: ["education", "academic background", "academics"],
  skills: ["skills", "technical skills", "core skills", "competencies", "core competencies", "expertise"],
  projects: ["projects", "selected projects", "side projects"],
  certifications: ["certifications", "certificates", "licenses"],
  awards: ["awards", "honors", "achievements", "recognition"],
  publications: ["publications", "papers", "selected publications"],
  volunteer: ["volunteer", "volunteering", "community"],
  languages: ["languages"],
  interests: ["interests", "hobbies"],
};

type SectionKind = keyof typeof SECTION_ALIASES | "other";

/** Returns the section kind for a heading line, or null if it isn't a heading. */
function classifyHeading(line: string): { kind: SectionKind; raw: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return null;

  // Heading-like: short, no terminal punctuation, mostly letters/spaces
  if (/[.!?]$/.test(trimmed)) return null;
  // Lines with bullet markers aren't headings
  if (/^[•·\-*]\s/.test(trimmed)) return null;

  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  for (const [kind, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(normalized)) {
      return { kind: kind as SectionKind, raw: trimmed };
    }
  }

  // ALL-CAPS short line = likely an unrecognized section heading
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const wordCount = trimmed.split(/\s+/).length;
  if (isAllCaps && wordCount <= 4) {
    return { kind: "other", raw: trimmed };
  }

  return null;
}

// ─── Contact extraction ─────────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\/?/i;
const URL_RE = /https?:\/\/[^\s,;]+/;

function extractContact(lines: string[]): { contact: ContactBlock; consumedLineCount: number } {
  const contact: ContactBlock = { otherLinks: [] };
  let consumed = 0;

  // Walk top of resume until we hit a section heading or run 8 lines.
  // The first non-empty, non-contact-marker line is treated as the name.
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    const heading = classifyHeading(line);
    // Only break on a *recognised* section heading (summary, experience, etc.).
    // An unrecognised all-caps line (heading.kind === "other") with 2+ words is
    // likely the candidate's name in all-caps — don't let it terminate the
    // contact block before we have a chance to detect it.
    if (heading && (heading.kind !== "other" || line.trim().split(/\s+/).length <= 1)) break;
    consumed = i + 1;

    const email = line.match(EMAIL_RE)?.[0];
    const phone = line.match(PHONE_RE)?.[0];
    const linkedin = line.match(LINKEDIN_RE)?.[0];
    const github = line.match(GITHUB_RE)?.[0];

    if (email && !contact.email) contact.email = email;
    if (phone && !contact.phone) contact.phone = phone;
    if (linkedin && !contact.linkedin) contact.linkedin = linkedin;
    if (github && !contact.github) contact.github = github;

    // First "namey" line: no email/phone/url, ≤6 words, mostly letters
    if (
      !contact.name &&
      !email &&
      !phone &&
      !linkedin &&
      !github &&
      !URL_RE.test(line) &&
      line.split(/\s+/).length <= 6 &&
      /^[A-Za-z][A-Za-z\s.'-]+$/.test(line.trim())
    ) {
      contact.name = line.trim();
      continue;
    }

    // Headline: line right after name that isn't contact data
    if (
      contact.name &&
      !contact.headline &&
      !email &&
      !phone &&
      !linkedin &&
      !github &&
      line.trim().length < 80
    ) {
      contact.headline = line.trim();
      continue;
    }

    // Other URLs go into otherLinks
    const url = line.match(URL_RE)?.[0];
    if (url && !linkedin && !github) {
      contact.otherLinks!.push(url);
    }

    // Best-effort location: a line that has a comma and short tokens (e.g. "San Francisco, CA")
    if (!contact.location && /^[A-Za-z\s.,'-]+,\s*[A-Z]{2}$/.test(line.trim())) {
      contact.location = line.trim();
    }
  }

  if (contact.otherLinks?.length === 0) delete contact.otherLinks;
  return { contact, consumedLineCount: consumed };
}

// ─── Section parsing ────────────────────────────────────────────────────────

function isBullet(line: string): boolean {
  return /^[•·\-*▪◦‣→]\s+/.test(line.trim());
}

function stripBulletMarker(line: string): string {
  return line.trim().replace(/^[•·\-*▪◦‣→]\s+/, "").trim();
}

/** Heuristic: "Title | Company | Location | Dates" or stacked variants. */
function parseExperience(blockLines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let current: ExperienceItem | null = null;

  const pushCurrent = () => {
    if (current && (current.bullets.length || current.title || current.company)) {
      items.push(current);
    }
    current = null;
  };

  for (const rawLine of blockLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isBullet(line)) {
      if (!current) {
        // Bullet without a header — start a placeholder item
        current = { title: "", company: "", bullets: [] };
      }
      current.bullets.push({ text: stripBulletMarker(line) });
      continue;
    }

    // Non-bullet line = potential new role header.
    // We start a new role when:
    //   a) there is no current role yet, OR
    //   b) the current role already has bullets (most common case), OR
    //   c) the line itself contains a date-range pattern like "2023 — 2025" or
    //      "Jan 2024 – Present" — this is a strong signal of a new role header
    //      even when multiple job entries appear back-to-back without bullets.
    const DATE_RANGE_RE = /\b\d{4}\s*[-–—]\s*(?:\d{4}|[Pp]resent)/;
    const looksLikeNewRole =
      !current || current.bullets.length > 0 || DATE_RANGE_RE.test(line);

    if (looksLikeNewRole) {
      pushCurrent();
      current = parseRoleHeader(line);
    } else if (current) {
      // Continuation of role header (multi-line stacked format)
      enrichRoleHeader(current, line);
    }
  }

  pushCurrent();
  return items;
}

function parseRoleHeader(line: string): ExperienceItem {
  // Try pipe / bullet / em-dash / dash / "at" separators
  const parts = line
    .split(/\s+(?:[|·•—–\-]|@|at)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      title: parts[0],
      company: parts[1],
      location: parts[2],
      dates: parts[3],
      bullets: [],
    };
  }
  // Single-line header — assume it's the title; company will come on next line
  return { title: line, company: "", bullets: [] };
}

function enrichRoleHeader(item: ExperienceItem, line: string) {
  if (!item.company) {
    // Second header line is usually company / location / dates
    const parts = line.split(/\s+(?:[|·•—–\-])\s+/).map((s) => s.trim()).filter(Boolean);
    item.company = parts[0] ?? line;
    if (parts[1]) item.location = parts[1];
    if (parts[2]) item.dates = parts[2];
    return;
  }
  if (!item.dates && /\d{4}/.test(line)) {
    item.dates = line;
    return;
  }
  // Otherwise treat as role description
  item.description = item.description ? `${item.description} ${line}` : line;
}

function parseEducation(blockLines: string[]): EducationItem[] {
  const items: EducationItem[] = [];
  let current: EducationItem | null = null;

  const push = () => {
    if (current && (current.institution || current.degree)) items.push(current);
    current = null;
  };

  for (const rawLine of blockLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isBullet(line)) {
      if (!current) current = { institution: "", details: [] };
      current.details = [...(current.details ?? []), stripBulletMarker(line)];
      continue;
    }

    if (!current) {
      current = { institution: line, details: [] };
      continue;
    }

    if (!current.degree) {
      current.degree = line;
      continue;
    }
    if (!current.dates && /\d{4}/.test(line)) {
      current.dates = line;
      continue;
    }
    // Anything else: treat as a detail line
    current.details = [...(current.details ?? []), line];
  }

  push();
  return items;
}

function parseSkills(blockLines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];

  for (const rawLine of blockLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Pattern: "Languages: TypeScript, Python, Go"
    const m = line.match(/^([A-Za-z][A-Za-z\s/&]+?):\s*(.+)$/);
    if (m) {
      const items = m[2].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (items.length) {
        groups.push({ category: m[1].trim(), items });
        continue;
      }
    }

    // Plain comma list with no header
    const items = line.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (items.length > 1) {
      groups.push({ items });
      continue;
    }

    // Single-item line — bucket into an "Other" group
    if (items.length === 1) {
      const last = groups[groups.length - 1];
      if (last && !last.category) {
        last.items.push(items[0]);
      } else {
        groups.push({ items });
      }
    }
  }

  return groups;
}

function parseSummary(blockLines: string[]): string {
  return blockLines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
}

function parseOtherSection(heading: string, blockLines: string[]): OtherSection {
  return {
    heading,
    lines: blockLines.map((l) => l.trim()).filter(Boolean),
  };
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function parsePdfMaster(pdfBuffer: Buffer): Promise<ResumeStructure> {
  const warnings: string[] = [];
  let text: string;

  try {
    const result = await pdfParse(pdfBuffer);
    text = result.text || "";
  } catch (err) {
    throw new Error(`Failed to read PDF: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!text.trim()) {
    warnings.push("PDF text extraction returned empty — file may be scanned/image-based.");
    return emptyStructure(warnings, "low");
  }

  // Normalize whitespace; pdf-parse can produce odd line breaks.
  const allLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/ /g, " ").trimEnd());

  // Strip leading blanks
  while (allLines.length && !allLines[0].trim()) allLines.shift();

  // Step 1: contact block
  const { contact, consumedLineCount } = extractContact(allLines);
  let cursor = consumedLineCount;

  // Step 2: walk sections
  let summary: string | undefined;
  const experience: ExperienceItem[] = [];
  const education: EducationItem[] = [];
  const skills: SkillGroup[] = [];
  const other: OtherSection[] = [];
  const unclassifiedHeadings: string[] = [];

  type Pending = { kind: SectionKind; raw: string; lines: string[] };
  let pending: Pending | null = null;

  const commit = () => {
    if (!pending) return;
    const { kind, raw, lines } = pending;
    switch (kind) {
      case "summary":
        summary = parseSummary(lines);
        break;
      case "experience":
        experience.push(...parseExperience(lines));
        break;
      case "education":
        education.push(...parseEducation(lines));
        break;
      case "skills":
        skills.push(...parseSkills(lines));
        break;
      default:
        // projects, certifications, awards, publications, volunteer, languages, interests, other
        other.push(parseOtherSection(raw, lines));
        if (kind === "other") unclassifiedHeadings.push(raw);
    }
    pending = null;
  };

  while (cursor < allLines.length) {
    const line = allLines[cursor];
    const heading = classifyHeading(line);

    if (heading) {
      commit();
      pending = { kind: heading.kind, raw: heading.raw, lines: [] };
    } else if (pending) {
      pending.lines.push(line);
    } else if (line.trim() && !summary) {
      // Pre-section content with no heading — treat as summary
      pending = { kind: "summary", raw: "Summary", lines: [line] };
    }

    cursor++;
  }
  commit();

  // Confidence scoring: did we get the basics?
  let confidence: "high" | "medium" | "low" = "high";
  if (!contact.name) {
    warnings.push("Could not detect candidate name from contact block.");
    confidence = "medium";
  }
  if (experience.length === 0) {
    warnings.push("No experience section detected.");
    confidence = "low";
  }

  return {
    contact,
    summary,
    experience,
    education,
    skills,
    other,
    meta: {
      sourceFormat: "pdf",
      parseConfidence: confidence,
      parseWarnings: warnings,
      unclassifiedHeadings: unclassifiedHeadings.length ? unclassifiedHeadings : undefined,
    },
  };
}

function emptyStructure(warnings: string[], confidence: "high" | "medium" | "low"): ResumeStructure {
  return {
    contact: {},
    experience: [],
    education: [],
    skills: [],
    other: [],
    meta: {
      sourceFormat: "pdf",
      parseConfidence: confidence,
      parseWarnings: warnings,
    },
  };
}
