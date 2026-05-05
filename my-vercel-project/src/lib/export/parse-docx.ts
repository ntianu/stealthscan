/**
 * Parse a DOCX master resume into a ResumeStructure.
 *
 * Approach:
 *   1. Unzip the .docx (it's a ZIP of XML files).
 *   2. Read `word/document.xml` and parse with fast-xml-parser.
 *   3. Walk each paragraph (`<w:p>`), concatenating text runs into the
 *      paragraph's plain-text content and noting whether the paragraph is
 *      bulleted (has `<w:numPr>`) or styled as a heading (`<w:pStyle>` ref).
 *   4. Apply the same section-classification heuristics as parse-pdf to turn
 *      the paragraph stream into a ResumeStructure.
 *
 * Note: this parser is *only* used for the merger and for PDF rendering when
 * the master is DOCX. For DOCX export of a DOCX master, we use the original
 * buffer directly via render-docx-edit — that path doesn't need this structure.
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import type {
  ContactBlock,
  EducationItem,
  ExperienceItem,
  OtherSection,
  ResumeStructure,
  SkillGroup,
} from "./types";

// ─── Section aliases (mirror parse-pdf for consistency) ─────────────────────

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

// ─── Paragraph extraction ───────────────────────────────────────────────────

interface DocxParagraph {
  text: string;
  isBullet: boolean;
  /** Pre-applied style reference (e.g. "Heading1"); empty when none. */
  styleRef?: string;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\/?/i;
const URL_RE = /https?:\/\/[^\s,;]+/;

function classifyHeading(p: DocxParagraph): { kind: SectionKind; raw: string } | null {
  if (p.isBullet) return null;
  const trimmed = p.text.trim();
  if (!trimmed || trimmed.length > 60) return null;
  if (/[.!?]$/.test(trimmed)) return null;

  // Word's heading styles are a strong signal even when the text doesn't match an alias.
  const isStyledHeading = !!p.styleRef && /heading\d?/i.test(p.styleRef);

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

  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const wordCount = trimmed.split(/\s+/).length;
  if ((isAllCaps && wordCount <= 4) || (isStyledHeading && wordCount <= 6)) {
    return { kind: "other", raw: trimmed };
  }

  return null;
}

// ─── Internal: walk parsed XML to extract paragraphs ────────────────────────

interface XmlNode {
  [k: string]: unknown;
}

/**
 * Recursively gather all `<w:p>` elements from the body. fast-xml-parser
 * structures children either as arrays (when multiple of the same tag) or
 * scalars — we normalize via this helper.
 */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function extractParagraphs(documentXml: XmlNode): DocxParagraph[] {
  const doc = (documentXml["w:document"] as XmlNode) ?? documentXml;
  const body = doc["w:body"] as XmlNode | undefined;
  if (!body) return [];

  const paragraphs = asArray<XmlNode>(body["w:p"] as XmlNode | XmlNode[] | undefined);

  return paragraphs.map((p) => {
    // Concatenate all <w:t> text inside the paragraph
    const runs = asArray<XmlNode>(p["w:r"] as XmlNode | XmlNode[] | undefined);
    const textParts: string[] = [];
    for (const run of runs) {
      const t = run["w:t"];
      if (typeof t === "string") textParts.push(t);
      else if (t && typeof t === "object") {
        const text = (t as XmlNode)["#text"];
        if (typeof text === "string") textParts.push(text);
      }
      // Tab handling
      if (run["w:tab"] !== undefined) textParts.push("\t");
      // Soft break inside a run
      if (run["w:br"] !== undefined) textParts.push(" ");
    }
    const text = textParts.join("").replace(/\s+/g, " ").trim();

    // Bullet detection: <w:pPr><w:numPr>...</w:numPr></w:pPr>
    const pPr = p["w:pPr"] as XmlNode | undefined;
    const isBullet = !!(pPr && pPr["w:numPr"]);

    // Style ref: <w:pPr><w:pStyle w:val="Heading1"/>
    let styleRef: string | undefined;
    if (pPr) {
      const pStyle = pPr["w:pStyle"] as XmlNode | undefined;
      if (pStyle) {
        const val = pStyle["@_w:val"];
        if (typeof val === "string") styleRef = val;
      }
    }

    return { text, isBullet, styleRef };
  });
}

// ─── Contact extraction ─────────────────────────────────────────────────────

function extractContact(paragraphs: DocxParagraph[]): { contact: ContactBlock; consumed: number } {
  const contact: ContactBlock = { otherLinks: [] };
  let consumed = 0;

  for (let i = 0; i < Math.min(paragraphs.length, 8); i++) {
    const p = paragraphs[i];
    if (classifyHeading(p)) break;
    consumed = i + 1;
    const line = p.text;
    if (!line) continue;

    const email = line.match(EMAIL_RE)?.[0];
    const phone = line.match(PHONE_RE)?.[0];
    const linkedin = line.match(LINKEDIN_RE)?.[0];
    const github = line.match(GITHUB_RE)?.[0];

    if (email && !contact.email) contact.email = email;
    if (phone && !contact.phone) contact.phone = phone;
    if (linkedin && !contact.linkedin) contact.linkedin = linkedin;
    if (github && !contact.github) contact.github = github;

    if (
      !contact.name &&
      !email && !phone && !linkedin && !github &&
      !URL_RE.test(line) &&
      line.split(/\s+/).length <= 6 &&
      /^[A-Za-z][A-Za-z\s.'-]+$/.test(line)
    ) {
      contact.name = line;
      continue;
    }

    if (
      contact.name && !contact.headline &&
      !email && !phone && !linkedin && !github && line.length < 80
    ) {
      contact.headline = line;
      continue;
    }

    const url = line.match(URL_RE)?.[0];
    if (url && !linkedin && !github) {
      contact.otherLinks!.push(url);
    }

    if (!contact.location && /^[A-Za-z\s.,'-]+,\s*[A-Z]{2}$/.test(line)) {
      contact.location = line;
    }
  }

  if (contact.otherLinks?.length === 0) delete contact.otherLinks;
  return { contact, consumed };
}

// ─── Section parsers (very similar to parse-pdf — duplicated for simplicity) ─

function parseExperience(blockLines: DocxParagraph[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let current: ExperienceItem | null = null;

  const push = () => {
    if (current && (current.bullets.length || current.title || current.company)) {
      items.push(current);
    }
    current = null;
  };

  for (const p of blockLines) {
    const line = p.text;
    if (!line) continue;

    if (p.isBullet) {
      if (!current) current = { title: "", company: "", bullets: [] };
      current.bullets.push({ text: line });
      continue;
    }

    if (!current || current.bullets.length > 0) {
      push();
      const parts = line
        .split(/\s+(?:[|·•—–\-]|@|at)\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
      current = parts.length >= 2
        ? { title: parts[0], company: parts[1], location: parts[2], dates: parts[3], bullets: [] }
        : { title: line, company: "", bullets: [] };
    } else if (current && !current.company) {
      const parts = line.split(/\s+(?:[|·•—–\-])\s+/).map((s) => s.trim()).filter(Boolean);
      current.company = parts[0] ?? line;
      if (parts[1]) current.location = parts[1];
      if (parts[2]) current.dates = parts[2];
    } else if (current && !current.dates && /\d{4}/.test(line)) {
      current.dates = line;
    } else if (current) {
      current.description = current.description ? `${current.description} ${line}` : line;
    }
  }

  push();
  return items;
}

function parseEducation(blockLines: DocxParagraph[]): EducationItem[] {
  const items: EducationItem[] = [];
  let current: EducationItem | null = null;

  const push = () => {
    if (current && (current.institution || current.degree)) items.push(current);
    current = null;
  };

  for (const p of blockLines) {
    const line = p.text;
    if (!line) continue;

    if (p.isBullet) {
      if (!current) current = { institution: "", details: [] };
      current.details = [...(current.details ?? []), line];
      continue;
    }

    if (!current) { current = { institution: line, details: [] }; continue; }
    if (!current.degree) { current.degree = line; continue; }
    if (!current.dates && /\d{4}/.test(line)) { current.dates = line; continue; }
    current.details = [...(current.details ?? []), line];
  }

  push();
  return items;
}

function parseSkills(blockLines: DocxParagraph[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  for (const p of blockLines) {
    const line = p.text;
    if (!line) continue;

    const m = line.match(/^([A-Za-z][A-Za-z\s/&]+?):\s*(.+)$/);
    if (m) {
      const items = m[2].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (items.length) { groups.push({ category: m[1].trim(), items }); continue; }
    }

    const items = line.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (items.length > 1) { groups.push({ items }); continue; }

    if (items.length === 1) {
      const last = groups[groups.length - 1];
      if (last && !last.category) last.items.push(items[0]);
      else groups.push({ items });
    }
  }
  return groups;
}

function parseSummary(blockLines: DocxParagraph[]): string {
  return blockLines.map((p) => p.text).filter(Boolean).join(" ");
}

function parseOtherSection(heading: string, blockLines: DocxParagraph[]): OtherSection {
  return { heading, lines: blockLines.map((p) => p.text).filter(Boolean) };
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function parseDocxMaster(docxBuffer: Buffer): Promise<ResumeStructure> {
  const warnings: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(docxBuffer);
  } catch (err) {
    throw new Error(`Failed to read DOCX: ${err instanceof Error ? err.message : String(err)}`);
  }

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    return emptyStructure(["DOCX missing word/document.xml"], "low");
  }

  const xml = await documentFile.async("string");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
  });
  const parsed = parser.parse(xml) as XmlNode;
  const paragraphs = extractParagraphs(parsed);

  if (paragraphs.length === 0) {
    return emptyStructure(["No paragraphs found in DOCX body."], "low");
  }

  const { contact, consumed } = extractContact(paragraphs);
  let cursor = consumed;

  let summary: string | undefined;
  const experience: ExperienceItem[] = [];
  const education: EducationItem[] = [];
  const skills: SkillGroup[] = [];
  const other: OtherSection[] = [];
  const unclassifiedHeadings: string[] = [];

  type Pending = { kind: SectionKind; raw: string; lines: DocxParagraph[] };
  let pending: Pending | null = null;

  const commit = () => {
    if (!pending) return;
    const { kind, raw, lines } = pending;
    switch (kind) {
      case "summary":   summary = parseSummary(lines); break;
      case "experience": experience.push(...parseExperience(lines)); break;
      case "education":  education.push(...parseEducation(lines)); break;
      case "skills":     skills.push(...parseSkills(lines)); break;
      default:
        other.push(parseOtherSection(raw, lines));
        if (kind === "other") unclassifiedHeadings.push(raw);
    }
    pending = null;
  };

  while (cursor < paragraphs.length) {
    const p = paragraphs[cursor];
    const heading = classifyHeading(p);

    if (heading) {
      commit();
      pending = { kind: heading.kind, raw: heading.raw, lines: [] };
    } else if (pending) {
      pending.lines.push(p);
    } else if (p.text && !summary) {
      pending = { kind: "summary", raw: "Summary", lines: [p] };
    }

    cursor++;
  }
  commit();

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
      sourceFormat: "docx",
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
      sourceFormat: "docx",
      parseConfidence: confidence,
      parseWarnings: warnings,
    },
  };
}
