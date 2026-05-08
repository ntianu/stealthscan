/**
 * Render a cover letter as a DOCX buffer.
 *
 * Uses the `docx` v9 lib. Letter style: clean letterhead at the top
 * (sender name + contact line, divider), then date, recipient block,
 * and body paragraphs.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { CoverLetterInput } from "./cover-letter-types";

const FONT = "Calibri";
const NAME_SIZE = 28; // 14pt
const BODY_SIZE = 22; // 11pt
const SMALL_SIZE = 19; // ~9.5pt

function run(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    bold: opts.bold,
    italics: opts.italic,
    size: opts.size ?? BODY_SIZE,
  });
}

function todayString(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function renderCoverLetterDocx(input: CoverLetterInput): Promise<Buffer> {
  const { sender, recipient, body, date } = input;

  const children: Paragraph[] = [];

  // Letterhead — sender name + contact line, with bottom border
  if (sender.name) {
    children.push(
      new Paragraph({
        children: [run(sender.name, { bold: true, size: NAME_SIZE })],
        spacing: { after: 40 },
      })
    );
  }

  const contactBits: string[] = [];
  if (sender.email) contactBits.push(sender.email);
  if (sender.phone) contactBits.push(sender.phone);
  if (sender.location) contactBits.push(sender.location);
  if (sender.linkedin) contactBits.push(sender.linkedin);

  if (contactBits.length) {
    children.push(
      new Paragraph({
        children: [run(contactBits.join("  ·  "), { size: SMALL_SIZE })],
        border: {
          bottom: { color: "1A1A1A", space: 4, style: BorderStyle.SINGLE, size: 6 },
        },
        spacing: { after: 320 },
      })
    );
  } else if (sender.name) {
    // Border still helpful even if no contact bits
    children.push(
      new Paragraph({
        children: [run("")],
        border: {
          bottom: { color: "1A1A1A", space: 4, style: BorderStyle.SINGLE, size: 6 },
        },
        spacing: { after: 320 },
      })
    );
  }

  // Date
  children.push(
    new Paragraph({
      children: [run(date ?? todayString())],
      spacing: { after: 240 },
    })
  );

  // Recipient block
  if (recipient.contact) {
    children.push(new Paragraph({ children: [run(recipient.contact)], spacing: { after: 0 } }));
  }
  children.push(new Paragraph({ children: [run(recipient.company)], spacing: { after: 0 } }));
  if (recipient.location) {
    children.push(new Paragraph({ children: [run(recipient.location)], spacing: { after: 240 } }));
  } else {
    // Pad if no location line
    children.push(new Paragraph({ children: [run("")], spacing: { after: 120 } }));
  }

  // Body — split on double newlines for paragraphs, single newlines = soft break (TextRun.break)
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    const lines = para.split(/\n/);
    const runs: TextRun[] = [];
    lines.forEach((line, idx) => {
      runs.push(run(line));
      if (idx < lines.length - 1) {
        runs.push(new TextRun({ break: 1 }));
      }
    });
    children.push(
      new Paragraph({
        children: runs,
        alignment: AlignmentType.LEFT,
        spacing: { after: 240, line: 320 }, // ~1.33 line height
      })
    );
  }

  const doc = new Document({
    creator: "Stealth Scan",
    title: sender.name ? `${sender.name} — Cover Letter` : "Cover Letter",
    styles: {
      default: { document: { run: { font: FONT, size: BODY_SIZE } } },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
