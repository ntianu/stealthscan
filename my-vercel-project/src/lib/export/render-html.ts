/**
 * Render a MergedResume to a self-contained HTML string.
 *
 * Used as input to the PDF renderer (via Playwright) and potentially
 * reusable for an in-app HTML preview. All CSS is inline.
 *
 * Deliberately conservative: system fonts only, no external assets,
 * no JS, no remote stylesheets. The output should print identically on
 * any Chromium and look reasonable in any modern browser.
 */

import type {
  ContactBlock,
  EducationItem,
  ExperienceItem,
  MergedResume,
  OtherSection,
  SkillGroup,
} from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHeader(contact: ContactBlock): string {
  const parts: string[] = [];

  if (contact.name) {
    parts.push(`<h1 class="name">${escapeHtml(contact.name)}</h1>`);
  }
  if (contact.headline) {
    parts.push(`<div class="headline">${escapeHtml(contact.headline)}</div>`);
  }

  const bits: string[] = [];
  if (contact.email) bits.push(escapeHtml(contact.email));
  if (contact.phone) bits.push(escapeHtml(contact.phone));
  if (contact.location) bits.push(escapeHtml(contact.location));
  if (contact.linkedin) bits.push(escapeHtml(contact.linkedin));
  if (contact.github) bits.push(escapeHtml(contact.github));
  if (contact.portfolio) bits.push(escapeHtml(contact.portfolio));

  if (bits.length) {
    parts.push(`<div class="contact">${bits.join("  &bull;  ")}</div>`);
  }

  return parts.join("\n");
}

function sectionBlock(title: string, body: string): string {
  if (!body.trim()) return "";
  return `
    <section class="section">
      <h2 class="section-heading">${escapeHtml(title.toUpperCase())}</h2>
      ${body}
    </section>
  `;
}

function renderSummary(summary: string | undefined): string {
  if (!summary?.trim()) return "";
  return sectionBlock("Summary", `<p class="summary">${escapeHtml(summary.trim())}</p>`);
}

function renderExperience(items: ExperienceItem[]): string {
  if (!items.length) return "";

  const blocks = items.map((item) => {
    const left: string[] = [];
    if (item.title) left.push(`<span class="role-title">${escapeHtml(item.title)}</span>`);
    if (item.company) left.push(`<span class="role-company">${escapeHtml(item.company)}</span>`);
    if (item.location) left.push(`<span class="role-location">${escapeHtml(item.location)}</span>`);

    const right = item.dates ? `<span class="role-dates">${escapeHtml(item.dates)}</span>` : "";

    const bullets = item.bullets
      .map((b) => `<li>${escapeHtml(b.text)}</li>`)
      .join("");

    const description = item.description
      ? `<p class="role-description">${escapeHtml(item.description)}</p>`
      : "";

    return `
      <div class="role">
        <div class="role-header">
          <div class="role-header-left">${left.join('<span class="role-sep">  &mdash;  </span>')}</div>
          ${right ? `<div class="role-header-right">${right}</div>` : ""}
        </div>
        ${description}
        ${bullets ? `<ul class="bullets">${bullets}</ul>` : ""}
      </div>
    `;
  });

  return sectionBlock("Experience", blocks.join("\n"));
}

function renderEducation(items: EducationItem[]): string {
  if (!items.length) return "";

  const blocks = items.map((item) => {
    const left: string[] = [];
    if (item.institution) left.push(`<span class="edu-inst">${escapeHtml(item.institution)}</span>`);
    if (item.degree) left.push(`<span class="edu-degree">${escapeHtml(item.degree)}</span>`);

    const right = item.dates ? `<span class="edu-dates">${escapeHtml(item.dates)}</span>` : "";

    const details = item.details?.length
      ? `<ul class="bullets">${item.details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
      : "";

    return `
      <div class="edu">
        <div class="edu-header">
          <div class="edu-header-left">${left.join('<span class="edu-sep">  &bull;  </span>')}</div>
          ${right ? `<div class="edu-header-right">${right}</div>` : ""}
        </div>
        ${item.location ? `<div class="edu-location">${escapeHtml(item.location)}</div>` : ""}
        ${details}
      </div>
    `;
  });

  return sectionBlock("Education", blocks.join("\n"));
}

function renderSkills(groups: SkillGroup[]): string {
  if (!groups.length) return "";
  const lines = groups.map((g) => {
    const items = escapeHtml(g.items.join(", "));
    return g.category
      ? `<p class="skill-line"><span class="skill-cat">${escapeHtml(g.category)}:</span> ${items}</p>`
      : `<p class="skill-line">${items}</p>`;
  });
  return sectionBlock("Skills", lines.join("\n"));
}

function renderOther(sections: OtherSection[]): string {
  if (!sections.length) return "";
  return sections
    .map((s) => {
      const body = `<ul class="bullets">${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
      return sectionBlock(s.heading, body);
    })
    .join("\n");
}

const STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Calibri', 'Helvetica', 'Arial', sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    color: #1a1a1a;
    background: #fff;
  }
  .resume {
    max-width: 7.4in;
    margin: 0 auto;
    padding: 0;
  }
  .name {
    text-align: center;
    font-size: 18pt;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.02em;
  }
  .headline {
    text-align: center;
    font-size: 11pt;
    font-style: italic;
    margin: 0.05in 0 0.05in;
    color: #404040;
  }
  .contact {
    text-align: center;
    font-size: 9.5pt;
    margin: 0 0 0.2in;
    color: #404040;
  }
  .section {
    margin-top: 0.18in;
  }
  .section-heading {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid #1a1a1a;
    padding-bottom: 2px;
    margin: 0 0 0.08in;
  }
  .summary {
    margin: 0;
  }
  .role, .edu {
    margin-bottom: 0.12in;
  }
  .role-header, .edu-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.2in;
  }
  .role-title { font-weight: 700; }
  .role-company { font-style: italic; }
  .role-location { font-size: 9.5pt; color: #555; }
  .role-dates, .edu-dates { font-size: 9.5pt; color: #555; white-space: nowrap; }
  .role-sep, .edu-sep { color: #888; }
  .role-description {
    font-style: italic;
    font-size: 9.5pt;
    color: #404040;
    margin: 0.04in 0;
  }
  .bullets {
    margin: 0.04in 0 0;
    padding-left: 0.22in;
  }
  .bullets li {
    margin-bottom: 0.04in;
  }
  .edu-inst { font-weight: 700; }
  .edu-degree { font-size: 9.5pt; }
  .edu-location { font-size: 9.5pt; font-style: italic; color: #555; }
  .skill-line { margin: 0.04in 0; }
  .skill-cat { font-weight: 700; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export function renderResumeHtml(resume: MergedResume): string {
  const body = [
    renderHeader(resume.contact),
    renderSummary(resume.summary),
    renderExperience(resume.experience),
    renderEducation(resume.education),
    renderSkills(resume.skills),
    renderOther(resume.other),
  ]
    .filter(Boolean)
    .join("\n");

  const title = resume.contact.name ? `${resume.contact.name} — Resume` : "Resume";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="resume">
    ${body}
  </div>
</body>
</html>`;
}
