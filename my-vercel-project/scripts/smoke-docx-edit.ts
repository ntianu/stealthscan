/**
 * Smoke test for the DOCX surgical edit pipeline.
 *
 * Run via: `npx tsx scripts/smoke-docx-edit.ts`
 * (Add tsx as a dev dep if not present, or run with `node --loader ts-node`.)
 *
 * This builds a tiny DOCX in-memory, runs renderResumeDocxEdit on it,
 * and confirms (a) the output unzips, (b) word/document.xml is valid XML,
 * (c) the rewritten bullet text is present and the original is gone.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import { renderResumeDocxEdit } from "../src/lib/export/render-docx-edit";

async function buildTinyDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: "Jane Smith", bold: true })] }),
          new Paragraph({ children: [new TextRun("Senior Product Manager")] }),
          new Paragraph({ children: [new TextRun("jane@example.com  •  +1 555 123 4567")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Summary")] }),
          new Paragraph({ children: [new TextRun("Experienced PM with 8 years in fintech and SaaS.")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Experience")] }),
          new Paragraph({ children: [new TextRun({ text: "Acme Corp — Product Manager", bold: true })] }),
          new Paragraph({ children: [new TextRun("Led migration to a new billing platform serving 2M users.")] }),
          new Paragraph({ children: [new TextRun("Shipped onboarding redesign that improved D7 retention by 14%.")] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function main() {
  const original = await buildTinyDocx();
  console.log(`built tiny DOCX: ${original.byteLength} bytes`);

  const result = await renderResumeDocxEdit(original, {
    headline: "Senior Product Manager — Growth & Monetization",
    summary: "8-year PM with deep fintech and onboarding chops; ship with surgical focus on retention.",
    bullets: [
      {
        original: "Led migration to a new billing platform serving 2M users.",
        rewritten: "Drove $40M billing platform migration for 2M users with zero customer-facing downtime.",
        improvement: "Quantified scale + reliability outcome",
      },
      {
        original: "Shipped onboarding redesign that improved D7 retention by 14%.",
        rewritten: "Owned end-to-end onboarding redesign — D7 retention +14%, activation +22%.",
        improvement: "Layered second metric, repositioned ownership",
      },
      {
        original: "This bullet does not exist in the master.",
        rewritten: "Should land in unmatched.",
        improvement: "Sanity check for unmatched detection",
      },
    ],
    keywords: ["billing", "retention", "onboarding"],
    notes: "ignored by edit renderer",
  });

  console.log("edit result:", {
    appliedBulletCount: result.appliedBulletCount,
    unmatchedBullets: result.unmatchedBullets.map((u) => u.original),
    headlineApplied: result.headlineApplied,
    summaryApplied: result.summaryApplied,
    outBytes: result.buffer.byteLength,
  });

  // Validate structure: re-unzip, parse document.xml
  const zip = await JSZip.loadAsync(result.buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("word/document.xml missing in output!");
  const xml = await docFile.async("string");

  // Confirm valid XML
  const parser = new XMLParser({ ignoreAttributes: false });
  const tree = parser.parse(xml);
  if (!tree["w:document"]) throw new Error("not a valid Word document.xml!");

  // Confirm rewrites landed
  const flatText = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const expectations: Array<{ desc: string; mustInclude: string[]; mustExclude: string[] }> = [
    {
      desc: "first bullet rewrite",
      mustInclude: ["$40M billing platform migration"],
      mustExclude: ["Led migration to a new billing platform"],
    },
    {
      desc: "second bullet rewrite",
      mustInclude: ["D7 retention +14%, activation +22%"],
      mustExclude: ["Shipped onboarding redesign that improved D7 retention by 14%."],
    },
    {
      desc: "summary rewrite",
      mustInclude: ["8-year PM with deep fintech"],
      mustExclude: ["Experienced PM with 8 years in fintech and SaaS."],
    },
  ];

  let failed = 0;
  for (const e of expectations) {
    for (const inc of e.mustInclude) {
      if (!flatText.includes(inc)) {
        console.error(`✗ ${e.desc}: missing "${inc}"`);
        failed++;
      }
    }
    for (const exc of e.mustExclude) {
      if (flatText.includes(exc)) {
        console.error(`✗ ${e.desc}: still contains old text "${exc}"`);
        failed++;
      }
    }
  }

  if (result.unmatchedBullets.length !== 1) {
    console.error(`✗ expected 1 unmatched bullet, got ${result.unmatchedBullets.length}`);
    failed++;
  }

  if (failed === 0) {
    console.log("✓ all assertions passed");
  } else {
    console.error(`✗ ${failed} assertion(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
