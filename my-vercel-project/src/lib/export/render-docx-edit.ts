/**
 * Surgical edit of a DOCX master resume.
 *
 * Unlike render-docx (which builds a fresh document from a ResumeStructure),
 * this renderer takes the user's *actual* DOCX file as the layout source,
 * locates paragraphs whose text matches a ResumePack rewrite target, and
 * replaces just the text content while keeping all paragraph- and run-level
 * formatting intact (fonts, colors, indents, numbering, headers/footers, etc.).
 *
 * Approach:
 *   1. Unzip the .docx.
 *   2. Parse `word/document.xml` with fast-xml-parser in `preserveOrder` mode
 *      so the document round-trips losslessly (namespaces, attributes, comments).
 *   3. Walk the body's paragraph tree, computing each paragraph's concatenated
 *      visible text.
 *   4. For each ResumePack rewrite (bullet, headline, summary), find the first
 *      matching paragraph (by normalized text) and rewrite its runs:
 *        - keep the first `<w:r>` and replace its `<w:t>` text with the new value
 *        - empty (but keep) the remaining `<w:r>` elements so their style refs
 *          survive but the text doesn't duplicate
 *   5. Re-serialize and re-zip.
 *
 * Trade-off: per-word formatting *within* a bullet (rare in resumes) collapses
 * onto the first run's style. Paragraph-level styles (numbering, indent, font
 * choice) are fully preserved.
 */

import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

import type { ResumePackInput } from "./types";

export interface DocxEditResult {
  buffer: Buffer;
  appliedBulletCount: number;
  unmatchedBullets: Array<{ original: string; rewritten: string }>;
  headlineApplied: boolean;
  summaryApplied: boolean;
}

// ─── Text utilities ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/^[•·\-*▪◦‣→]\s*/, "")
    .replace(/\s+\[tags:[^\]]*\]$/, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── XML traversal helpers (preserveOrder array-of-objects shape) ───────────

/**
 * In preserveOrder mode, fast-xml-parser represents an element as
 *   { tagName: [ ...children ], ":@": { @_attr: value } }
 * with the first key being the tag name and `:@` holding attributes.
 * Text nodes are { "#text": "..." }.
 */
type OrderedNode = Record<string, unknown>;

function tagName(node: OrderedNode): string | null {
  for (const key of Object.keys(node)) {
    if (key !== ":@") return key;
  }
  return null;
}

function children(node: OrderedNode): OrderedNode[] {
  const tag = tagName(node);
  if (!tag) return [];
  const c = node[tag];
  return Array.isArray(c) ? (c as OrderedNode[]) : [];
}

function setChildren(node: OrderedNode, kids: OrderedNode[]) {
  const tag = tagName(node);
  if (!tag) return;
  node[tag] = kids;
}

function isTag(node: OrderedNode, name: string): boolean {
  return tagName(node) === name;
}

/** Concatenate all visible text under this node (recursive). */
function textOf(node: OrderedNode): string {
  let out = "";
  for (const child of children(node)) {
    if ("#text" in child) {
      const v = child["#text"];
      if (typeof v === "string") out += v;
    } else if (isTag(child, "w:t")) {
      out += textOf(child);
    } else if (isTag(child, "w:tab")) {
      out += "\t";
    } else if (isTag(child, "w:br")) {
      out += " ";
    } else {
      out += textOf(child);
    }
  }
  return out;
}

function paragraphText(p: OrderedNode): string {
  return textOf(p).replace(/\s+/g, " ").trim();
}

// ─── Run rewriting ──────────────────────────────────────────────────────────

/** Replace the visible text of the first `<w:r>` and empty subsequent runs. */
function rewriteParagraphText(p: OrderedNode, newText: string): boolean {
  const kids = children(p);
  let firstRunRewritten = false;

  for (const k of kids) {
    if (!isTag(k, "w:r")) continue;
    const runChildren = children(k);
    if (!firstRunRewritten) {
      // Find first <w:t> and replace its text node
      const newRunChildren: OrderedNode[] = [];
      let replaced = false;
      for (const rc of runChildren) {
        if (!replaced && isTag(rc, "w:t")) {
          newRunChildren.push({
            "w:t": [{ "#text": newText }],
            ":@": { "@_xml:space": "preserve" },
          } as OrderedNode);
          replaced = true;
        } else if (isTag(rc, "w:t")) {
          // Drop additional <w:t> nodes inside this run
        } else {
          // Keep run properties (`<w:rPr>`), tab markers, etc.
          newRunChildren.push(rc);
        }
      }
      if (!replaced) {
        // No <w:t> in first run — append one
        newRunChildren.push({
          "w:t": [{ "#text": newText }],
          ":@": { "@_xml:space": "preserve" },
        } as OrderedNode);
      }
      setChildren(k, newRunChildren);
      firstRunRewritten = true;
    } else {
      // Empty out text in subsequent runs (keep run properties intact)
      const newRunChildren: OrderedNode[] = runChildren.filter((rc) => !isTag(rc, "w:t"));
      setChildren(k, newRunChildren);
    }
  }

  return firstRunRewritten;
}

// ─── Body walking ───────────────────────────────────────────────────────────

/** Find all `<w:p>` paragraphs anywhere in the document tree (depth-first). */
function findAllParagraphs(root: OrderedNode[]): OrderedNode[] {
  const out: OrderedNode[] = [];
  const visit = (nodes: OrderedNode[]) => {
    for (const n of nodes) {
      if (isTag(n, "w:p")) out.push(n);
      const kids = children(n);
      if (kids.length) visit(kids);
    }
  };
  visit(root);
  return out;
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function renderResumeDocxEdit(
  originalDocxBuffer: Buffer,
  pack: ResumePackInput
): Promise<DocxEditResult> {
  const zip = await JSZip.loadAsync(originalDocxBuffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("DOCX missing word/document.xml — file may be corrupt or non-standard.");
  }

  const xml = await documentFile.async("string");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
    trimValues: false,
    parseAttributeValue: false,
  });
  const tree = parser.parse(xml) as OrderedNode[];

  const paragraphs = findAllParagraphs(tree);
  const used = new Set<number>();

  // ── Apply bullet rewrites ───────────────────────────────────────────────
  let appliedBulletCount = 0;
  const unmatchedBullets: DocxEditResult["unmatchedBullets"] = [];

  for (const item of pack.bullets) {
    const target = normalize(item.original);
    if (!target) {
      unmatchedBullets.push({ original: item.original, rewritten: item.rewritten });
      continue;
    }

    // Try exact normalized match first, then fall back to substring matches
    let foundIdx = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      if (used.has(i)) continue;
      const t = normalize(paragraphText(paragraphs[i]));
      if (t === target) { foundIdx = i; break; }
    }
    if (foundIdx === -1) {
      for (let i = 0; i < paragraphs.length; i++) {
        if (used.has(i)) continue;
        const t = normalize(paragraphText(paragraphs[i]));
        if (target.length > 30 && (t.startsWith(target.slice(0, 40)) || t.includes(target.slice(0, 30)) || target.includes(t.slice(0, 30)))) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx === -1) {
      unmatchedBullets.push({ original: item.original, rewritten: item.rewritten });
      continue;
    }

    if (rewriteParagraphText(paragraphs[foundIdx], item.rewritten)) {
      used.add(foundIdx);
      appliedBulletCount++;
    } else {
      unmatchedBullets.push({ original: item.original, rewritten: item.rewritten });
    }
  }

  // ── Headline + Summary: best-effort match ───────────────────────────────
  // Headline: short paragraph in the top 5 that isn't an email/url/phone
  let headlineApplied = false;
  if (pack.headline?.trim()) {
    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      if (used.has(i)) continue;
      const t = paragraphText(paragraphs[i]);
      if (!t || t.length > 100 || /@/.test(t) || /\d{3}/.test(t) || /https?:\/\//.test(t)) continue;
      // Skip the candidate name (usually first paragraph and longer-form)
      if (i === 0 && /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(t) && t.split(" ").length <= 4) continue;
      if (rewriteParagraphText(paragraphs[i], pack.headline.trim())) {
        used.add(i);
        headlineApplied = true;
        break;
      }
    }
  }

  // Summary: paragraph(s) under a "Summary"/"Profile"/"About" heading
  let summaryApplied = false;
  if (pack.summary?.trim()) {
    const summaryHeadings = ["summary", "profile", "about", "objective", "professional summary"];
    for (let i = 0; i < paragraphs.length; i++) {
      const headingText = paragraphText(paragraphs[i]).trim().toLowerCase();
      if (!summaryHeadings.includes(headingText)) continue;
      // Look at the next non-empty, non-heading paragraph
      for (let j = i + 1; j < paragraphs.length; j++) {
        if (used.has(j)) continue;
        const next = paragraphText(paragraphs[j]).trim();
        if (!next) continue;
        // Stop if we hit another heading
        if (next.length < 60 && /^[A-Z\s]+$/.test(next)) break;
        if (rewriteParagraphText(paragraphs[j], pack.summary.trim())) {
          used.add(j);
          summaryApplied = true;
        }
        break;
      }
      if (summaryApplied) break;
    }
  }

  // ── Serialize and rezip ─────────────────────────────────────────────────
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
    suppressEmptyNode: false,
  });
  const newXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + builder.build(tree);

  zip.file("word/document.xml", newXml);
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return {
    buffer: out,
    appliedBulletCount,
    unmatchedBullets,
    headlineApplied,
    summaryApplied,
  };
}
