/**
 * Shared types for the resume export pipeline.
 *
 * Pipeline shape:
 *   master file (PDF or DOCX)
 *     → parsers/parse-pdf.ts | parsers/parse-docx.ts (Phase B)
 *     → ResumeStructure
 *     → merge.ts (applies ResumePack rewrites)
 *     → renderers/render-docx.ts | renderers/render-pdf.ts
 *     → Buffer (downloaded by client)
 */

/** A single bullet line under an experience or project. */
export interface StructuredBullet {
  /** Original text as found in the master. */
  text: string;
  /** True when this bullet was rewritten by ResumePack. */
  rewritten?: boolean;
  /** Original text before rewrite — kept for diff/audit. */
  originalText?: string;
}

/** One position in the experience section. */
export interface ExperienceItem {
  title: string;
  company: string;
  location?: string;
  /** Free-form date range — we don't try to parse "Jan 2022 – Present" into structured dates. */
  dates?: string;
  bullets: StructuredBullet[];
  /** Any non-bullet content under this role (rare; mostly the role description). */
  description?: string;
}

/** One entry in the education section. */
export interface EducationItem {
  institution: string;
  degree?: string;
  /** e.g. "May 2020" or "2018 – 2022" */
  dates?: string;
  location?: string;
  /** GPA, honors, relevant coursework, etc. */
  details?: string[];
}

/** A grouped list of skills (e.g. "Languages: TypeScript, Python"). */
export interface SkillGroup {
  /** Optional header — "Languages", "Tools", "Soft skills". Empty when ungrouped. */
  category?: string;
  items: string[];
}

/** A misc section we don't have a typed shape for (Awards, Publications, Volunteer, etc.). */
export interface OtherSection {
  /** Section heading as it appears in the master. */
  heading: string;
  /** Free-form lines or bullets. */
  lines: string[];
}

/** Top-of-resume identity. */
export interface ContactBlock {
  name?: string;
  /** A short tagline / headline below the name (e.g. "Senior Product Manager"). */
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  /** Catch-all for any other contact lines we couldn't classify. */
  otherLinks?: string[];
}

/** Full structured representation of a resume, format-agnostic. */
export interface ResumeStructure {
  contact: ContactBlock;
  /** Professional summary / about / profile section. */
  summary?: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  /** Skills can be either a flat list or grouped — we always store as groups. */
  skills: SkillGroup[];
  /** Sections we didn't classify into the typed slots above. Preserved in render order. */
  other: OtherSection[];
  /** Metadata about how this structure was produced — used by renderers for hints. */
  meta: ResumeMeta;
}

export interface ResumeMeta {
  /** What the master file format was. */
  sourceFormat: "pdf" | "docx" | "manual";
  /** Whether parsing was confident. Low-confidence parses fall back to "best effort" rendering. */
  parseConfidence: "high" | "medium" | "low";
  /** Warnings the parser surfaced — empty when clean. */
  parseWarnings: string[];
  /** Sections that the parser found but couldn't classify; preserved as `other` entries. */
  unclassifiedHeadings?: string[];
}

/** Output of `merge.ts` — same shape as ResumeStructure, but with bullets/headline/summary swapped. */
export type MergedResume = ResumeStructure;

/**
 * Subset of ResumePack we care about for merging.
 * Mirrors the type in src/lib/ai/resume-pack.ts but copied here to avoid
 * a circular concern between AI generation and rendering layers.
 */
export interface ResumePackInput {
  headline: string;
  summary: string;
  bullets: Array<{
    original: string;
    rewritten: string;
    improvement: string;
  }>;
  keywords: string[];
  notes: string;
}

/**
 * Result returned to the renderer. Wraps MergedResume plus diagnostics
 * about what the merger could and couldn't apply.
 */
export interface MergeResult {
  resume: MergedResume;
  /** Bullets from ResumePack that we successfully matched into the structure. */
  appliedBullets: Array<{ original: string; rewritten: string; matchedAt: string }>;
  /** Bullets from ResumePack we couldn't locate in the master — appended to a "Highlights" section. */
  unmatchedBullets: Array<{ original: string; rewritten: string }>;
  /** Whether the merger had to inject a synthetic "Highlights" section to hold unmatched rewrites. */
  injectedHighlights: boolean;
}
