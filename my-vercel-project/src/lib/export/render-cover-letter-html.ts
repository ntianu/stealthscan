/**
 * Render a cover letter as a self-contained HTML document.
 *
 * Used as input to the PDF renderer (via Playwright). All CSS is inline;
 * no external assets, no JS, no remote stylesheets.
 */

import type { CoverLetterInput } from "./cover-letter-types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function todayString(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Calibri', 'Helvetica', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1a1a1a;
    background: #fff;
  }
  .letter { max-width: 7.4in; margin: 0 auto; }
  .letterhead {
    border-bottom: 1px solid #1a1a1a;
    padding-bottom: 0.1in;
    margin-bottom: 0.3in;
  }
  .sender-name { font-size: 14pt; font-weight: 700; }
  .sender-contact { font-size: 9.5pt; color: #404040; margin-top: 0.04in; }
  .letter-date { margin-bottom: 0.2in; }
  .recipient { margin-bottom: 0.3in; }
  .letter-body p { margin: 0 0 0.18in; }
  .letter-body p:last-child { margin-bottom: 0; }
`;

export function renderCoverLetterHtml(input: CoverLetterInput): string {
  const { sender, recipient, body, date } = input;

  const senderContactBits: string[] = [];
  if (sender.email) senderContactBits.push(escapeHtml(sender.email));
  if (sender.phone) senderContactBits.push(escapeHtml(sender.phone));
  if (sender.location) senderContactBits.push(escapeHtml(sender.location));
  if (sender.linkedin) senderContactBits.push(escapeHtml(sender.linkedin));

  const recipientLines: string[] = [];
  if (recipient.contact) recipientLines.push(escapeHtml(recipient.contact));
  recipientLines.push(escapeHtml(recipient.company));
  if (recipient.location) recipientLines.push(escapeHtml(recipient.location));

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  const title = sender.name ? `${sender.name} — Cover Letter` : "Cover Letter";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="letter">
    <div class="letterhead">
      ${sender.name ? `<div class="sender-name">${escapeHtml(sender.name)}</div>` : ""}
      ${senderContactBits.length ? `<div class="sender-contact">${senderContactBits.join("  &middot;  ")}</div>` : ""}
    </div>
    <div class="letter-date">${escapeHtml(date ?? todayString())}</div>
    <div class="recipient">${recipientLines.map((l) => `<div>${l}</div>`).join("")}</div>
    <div class="letter-body">${paragraphs}</div>
  </div>
</body>
</html>`;
}
