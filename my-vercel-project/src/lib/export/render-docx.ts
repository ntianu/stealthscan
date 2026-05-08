/**
 * Render a MergedResume into a DOCX buffer.
 *
 * Phase A approach: clean single-column neutral template. We don't try to
 * preserve the master's visual layout (the master is a PDF with no style
 * info we can carry over). Phase B will add a separate path that surgically
 * edits a DOCX master while preserving its styles.
 *
 * Library: `docx` v9 (https://github.com/dolanmiu/docx).
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  UnderlineType,
} from "docx";

import type {
  ContactBlock,
  EducationItem,
  ExperienceItem,
  MergedResume,
  OtherSection,
  SkillGroup,
} from "./types";

// ─── Style constants ────────────────────────────────────────────────────────

const FONT = "Calibri";
const NAME_SIZE = 32; // half-points (32 = 16pt)
const HEADLINE_SIZE = 22;
const SECTION_SIZE = 22;
const BODY_SIZE = 20; // 10pt
const SMALL_SIZE = 18;

// ─── Helpers ────────────────────────────────────────────────────────────────

function run(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    bold: opts.bold,
    italics: opts.italic,
    size: opts.size ?? BODY_SIZE,
  });
}

function emptyParagraph(): Paragraph {
  return new Paragraph({ children: [run("")] });
}

// ─── Header (name + headline + contact line) ────────────────────────────────

function renderHeader(contact: ContactBlock): Paragraph[] {
  const out: Paragraph[] = [];

  if (contact.name) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [run(contact.name, { bold: true, size: NAME_SIZE })],
      })
    );
  }

  if (contact.headline) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [run(contact.headline, { italic: true, size: HEADLINE_SIZE })],
      })
    );
  }

  const contactBits: string[] = [];
  if (contact.email) contactBits.push(contact.email);
  if (contact.phone) contactBits.push(contact.phone);
  if (contact.location) contactBits.push(contact.location);
  if (contact.linkedin) contactBits.push(contact.linkedin);
  if (contact.github) contactBits.push(contact.github);
  if (contact.portfolio) contactBits.push(contact.portfolio);

  if (contactBits.length) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [run(contactBits.join("  •  "), { size: SMALL_SIZE })],
      })
    );
  }

  return out;
}

// ─── Section headings ───────────────────────────────────────────────────────

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        font: FONT,
        bold: true,
        size: SECTION_SIZE,
        underline: { type: UnderlineType.SINGLE },
      }),
    ],
  });
}

// ─── Summary ────────────────────────────────────────────────────────────────

function renderSummary(summary: string | undefined): Paragraph[] {
  if (!summary?.trim()) return [];
  return [
    sectionHeading("Summary"),
    new Paragraph({
      spacing: { after: 120 },
      children: [run(summary.trim())],
    }),
  ];
}

// ─── Experience ─────────────────────────────────────────────────────────────

function renderExperience(items: ExperienceItem[]): Paragraph[] {
  if (!items.length) return [];
  const out: Paragraph[] = [sectionHeading("Experience")];

  for (const item of items) {
    // Title — Company, Location  ............................. Dates
    const titleLine: TextRun[] = [];
    if (item.title) titleLine.push(run(item.title, { bold: true }));
    if (item.title && item.company) titleLine.push(run(" — "));
    if (item.company) titleLine.push(run(item.company, { italic: true }));
    if (item.location) titleLine.push(run(`, ${item.location}`, { size: SMALL_SIZE }));

    // Right-tabbed dates
    if (item.dates) {
      titleLine.push(new TextRun({ text: "\t" }));
      titleLine.push(run(item.dates, { size: SMALL_SIZE }));
    }

    out.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: titleLine,
      })
    );

    if (item.description) {
      out.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [run(item.description, { italic: true, size: SMALL_SIZE })],
        })
      );
    }

    for (const bullet of item.bullets) {
      out.push(
        new Paragraph({
          numbering: { reference: "resume-bullets", level: 0 },
          spacing: { after: 40 },
          children: [run(bullet.text)],
        })
      );
    }
  }

  return out;
}

// ─── Education ──────────────────────────────────────────────────────────────

function renderEducation(items: EducationItem[]): Paragraph[] {
  if (!items.length) return [];
  const out: Paragraph[] = [sectionHeading("Education")];

  for (const item of items) {
    const headLine: TextRun[] = [];
    if (item.institution) headLine.push(run(item.institution, { bold: true }));
    if (item.degree) headLine.push(run(`  •  ${item.degree}`, { size: SMALL_SIZE }));
    if (item.dates) {
      headLine.push(new TextRun({ text: "\t" }));
      headLine.push(run(item.dates, { size: SMALL_SIZE }));
    }
    out.push(
      new Paragraph({
        spacing: { before: 80, after: 40 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: headLine,
      })
    );

    if (item.location) {
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [run(item.location, { size: SMALL_SIZE, italic: true })],
        })
      );
    }

    for (const detail of item.details ?? []) {
      out.push(
        new Paragraph({
          numbering: { reference: "resume-bullets", level: 0 },
          spacing: { after: 30 },
          children: [run(detail)],
        })
      );
    }
  }

  return out;
}

// ─── Skills ─────────────────────────────────────────────────────────────────

function renderSkills(groups: SkillGroup[]): Paragraph[] {
  if (!groups.length) return [];
  const out: Paragraph[] = [sectionHeading("Skills")];

  for (const group of groups) {
    const children: TextRun[] = [];
    if (group.category) {
      children.push(run(`${group.category}: `, { bold: true }));
    }
    children.push(run(group.items.join(", ")));
    out.push(
      new Paragraph({
        spacing: { after: 40 },
        children,
      })
    );
  }

  return out;
}

// ─── Other (Highlights, Awards, etc.) ───────────────────────────────────────

function renderOther(sections: OtherSection[]): Paragraph[] {
  if (!sections.length) return [];
  const out: Paragraph[] = [];
  for (const section of sections) {
    out.push(sectionHeading(section.heading));
    for (const line of section.lines) {
      out.push(
        new Paragraph({
          numbering: { reference: "resume-bullets", level: 0 },
          spacing: { after: 40 },
          children: [run(line)],
        })
      );
    }
  }
  return out;
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function renderResumeDocx(resume: MergedResume): Promise<Buffer> {
  const children: Paragraph[] = [
    ...renderHeader(resume.contact),
    ...renderSummary(resume.summary),
    ...renderExperience(resume.experience),
    ...renderEducation(resume.education),
    ...renderSkills(resume.skills),
    ...renderOther(resume.other),
  ];

  // Ensure we have at least one paragraph so docx doesn't error on empty
  if (children.length === 0) children.push(emptyParagraph());

  const doc = new Document({
    creator: "Stealth Scan",
    title: resume.contact.name ? `${resume.contact.name} — Resume` : "Resume",
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•", // •
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 360, hanging: 200 } },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 900, bottom: 720, left: 900 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
