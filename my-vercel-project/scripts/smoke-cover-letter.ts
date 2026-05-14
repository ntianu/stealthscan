/**
 * Smoke test for the cover letter renderers.
 *
 * Run: `npx tsx scripts/smoke-cover-letter.ts`
 *
 * Verifies:
 *   - DOCX renderer produces a valid .docx that re-unzips and re-parses
 *   - HTML renderer produces a valid HTML doc with the expected substrings
 *   - Paragraph splitting works (double-newline → separate paragraphs)
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import { renderCoverLetterDocx } from "../src/lib/export/render-cover-letter-docx";
import { renderCoverLetterHtml } from "../src/lib/export/render-cover-letter-html";
import type { CoverLetterInput } from "../src/lib/export/cover-letter-types";

const sampleLetter: CoverLetterInput = {
  sender: {
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "+1 555 123 4567",
    location: "Brooklyn, NY",
    linkedin: "linkedin.com/in/janesmith",
  },
  recipient: {
    company: "Acme Corp",
    location: "San Francisco, CA",
  },
  body: `Dear Hiring Team,

I'm excited to apply for the Senior Product Manager role. Over the last 8 years, I've shipped products that combined deep customer empathy with rigorous experimentation, most recently at FintechCo where I led a billing platform migration for 2M users.

The role's emphasis on growth and monetization aligns directly with my work on onboarding redesign (D7 retention +14%) and pricing page experiments that lifted ARPU 9% quarter-over-quarter.

I'd love to discuss how this translates to Acme's roadmap.

Sincerely,
Jane Smith`,
};

async function main() {
  let failed = 0;

  // ── HTML ────────────────────────────────────────────────────────────────
  const html = renderCoverLetterHtml(sampleLetter);
  const htmlExpect = [
    "Jane Smith",
    "jane@example.com",
    "Acme Corp",
    "San Francisco, CA",
    "I&#39;m excited to apply",
    "ARPU 9% quarter-over-quarter",
    "<p>", // paragraphs landed
  ];
  for (const e of htmlExpect) {
    if (!html.includes(e)) {
      console.error(`✗ HTML missing: ${e}`);
      failed++;
    }
  }
  if (!html.startsWith("<!doctype")) {
    console.error("✗ HTML missing doctype");
    failed++;
  }
  // 5 paragraphs expected (Dear / body1 / body2 / closing / Sincerely+name)
  const paraCount = (html.match(/<p>/g) || []).length;
  if (paraCount !== 5) {
    console.error(`✗ expected 5 <p> tags, got ${paraCount}`);
    failed++;
  }
  console.log(`HTML: ${html.length} bytes, ${paraCount} paragraphs`);

  // ── DOCX ────────────────────────────────────────────────────────────────
  const docxBuffer = await renderCoverLetterDocx(sampleLetter);
  console.log(`DOCX: ${docxBuffer.byteLength} bytes`);

  const zip = await JSZip.loadAsync(docxBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    console.error("✗ DOCX missing word/document.xml");
    failed++;
  } else {
    const xml = await docFile.async("string");
    const parser = new XMLParser({ ignoreAttributes: false });
    const tree = parser.parse(xml);
    if (!tree["w:document"]) {
      console.error("✗ DOCX not a valid Word document");
      failed++;
    }

    const flat = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const docxExpect = [
      "Jane Smith",
      "jane@example.com",
      "Acme Corp",
      "Dear Hiring Team",
      "ARPU 9% quarter-over-quarter",
      "Sincerely",
    ];
    for (const e of docxExpect) {
      if (!flat.includes(e)) {
        console.error(`✗ DOCX missing: ${e}`);
        failed++;
      }
    }
  }

  if (failed === 0) {
    console.log("✓ all cover letter assertions passed");
  } else {
    console.error(`✗ ${failed} assertion(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
