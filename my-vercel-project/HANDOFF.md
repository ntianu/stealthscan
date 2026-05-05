# Handoff — Resume Export Pipeline

**Branch:** `claude/elastic-wescoff`
**Author:** Cowork session (working alongside Claude Code on this worktree)

## What this is

A pipeline for generating tailored resume DOCX/PDF files from the existing
`generateResumePack()` AI output. Closes the "Resume Pack UI not wired" gap
called out in PRD §5 and §8.1, and adds DOCX surgical edits + PDF output.

## Phasing

| Phase | Scope | Status |
|-------|-------|--------|
| **A** | PDF master → clean DOCX template + PDF | ✅ Complete |
| **B** | DOCX master support + surgical edits | ✅ Complete |
| C | Cover letter export + persistence + polish | Not started |

## How the system dispatches

```
       ┌────────── master format ──────────┐
       │                                    │
     PDF                                   DOCX
       │                                    │
   parse-pdf.ts                       export type?
       │                                    │
   ResumeStructure                  DOCX ┐  ┌─ PDF
       │                                 │  │
   merge.ts                       parse-docx.ts
       │                            (still rebuild path)
   MergedResume                          │
       │                            ResumeStructure
   ┌───┴───┐                              │
DOCX    PDF                          merge.ts
 │        │                               │
render-  render-                     MergedResume
docx.ts  pdf.ts                           │
                                  ┌───────┴────────┐
                              DOCX edit         PDF rebuild
                                  │                 │
                          render-docx-edit.ts  render-pdf.ts
                          (surgical)           (HTML→Playwright)
```

The discriminator is `pipeline.ts > buildExportArtifact({ preferEdit })`. The
DOCX export route sets `preferEdit: true` so DOCX masters take the surgical
path. The PDF route sets `preferEdit: false` because rendering DOCX→PDF
server-side would need LibreOffice/Word, which we don't have.

## Files added across Phases A and B

### Phase A
| Path | Purpose |
|------|---------|
| `src/lib/export/types.ts` | `ResumeStructure`, `MergeResult`, `ResumePackInput` |
| `src/lib/export/parse-pdf.ts` | PDF → `ResumeStructure` (heuristic) |
| `src/lib/export/merge.ts` | Apply ResumePack rewrites onto `ResumeStructure` |
| `src/lib/export/render-docx.ts` | Build DOCX from scratch (`docx` v9 lib) |
| `src/lib/export/render-html.ts` | Self-contained HTML for PDF + future preview |
| `src/lib/export/render-pdf.ts` | HTML → PDF via Playwright |
| `src/lib/export/pipeline.ts` | Orchestrator returning `ExportArtifact` |
| `src/app/api/applications/[id]/export/docx/route.ts` | `POST` → `.docx` |
| `src/app/api/applications/[id]/export/pdf/route.ts` | `POST` → `.pdf` |

### Phase B (new in this push)
| Path | Purpose |
|------|---------|
| `src/lib/export/parse-docx.ts` | DOCX → `ResumeStructure` (used for PDF rendering when master is DOCX) |
| `src/lib/export/render-docx-edit.ts` | Surgical edit of master DOCX (preserves layout) |
| `scripts/smoke-docx-edit.ts` | Build tiny DOCX → run edit → assert text swaps; confirms XML round-trip works |

### Modified files

| Path | Change |
|------|--------|
| `package.json` | Phase A: `docx`, `pdf-parse`, `@types/pdf-parse`. Phase B: `jszip`, `fast-xml-parser` |
| `src/components/applications/review-panel.tsx` | Phase A: download buttons in Resume Pack tab |
| `src/lib/export/pipeline.ts` | Phase B: `ExportArtifact` discriminator, format detection, dispatch |
| `src/app/api/applications/[id]/export/docx/route.ts` | Phase B: handle `kind: "edit"` artifact |
| `src/app/api/applications/[id]/export/pdf/route.ts` | Phase B: enforce `kind: "rebuild"` (defensive) |
| `src/lib/uploadthing.ts` | Phase B: accept DOCX MIME type alongside PDF |
| `src/components/resumes/resume-uploader.tsx` | Phase B: accept `.docx`, update copy |

## Verification done in-session

- `npx tsc --noEmit` — clean (exit 0) after Phase A and after Phase B
- `npx eslint src/lib/export src/app/api/applications/[id]/export src/components/...` — no errors or warnings on touched files
- `npm run lint` (project-wide) — 5 pre-existing errors only, all in files I didn't author (4 in review-panel dealbreaker section, 1 in dashboard/page.tsx)
- `scripts/smoke-docx-edit.ts` — built a tiny DOCX, ran surgical edit, confirmed:
  - 2 of 3 bullets matched and replaced
  - 1 unmatched bullet correctly flagged
  - Headline and summary applied
  - Output re-unzipped + re-parsed as valid DOCX
  - Old text removed, new text present in `<w:t>` nodes

## How DOCX surgical edit works

`render-docx-edit.ts` parses `word/document.xml` with fast-xml-parser in
`preserveOrder` mode (which round-trips namespaces/attributes losslessly),
walks all `<w:p>` paragraphs, computes each one's concatenated visible text,
matches against `pack.bullets[].original` (using the same normalization as
the PDF merger), and rewrites the paragraph's runs:

- Keep the first `<w:r>` and replace its `<w:t>` text with the new value
- Keep run properties (`<w:rPr>`) so style refs survive
- Empty out (but don't delete) subsequent `<w:r>` elements so the paragraph
  doesn't end up with duplicated/leftover text

Trade-off: per-word formatting *within* a single bullet (rare in resumes)
collapses onto the first run's style. Paragraph-level styles (numbering,
indent, font choice, paragraph spacing) are fully preserved.

Headline and summary use looser heuristics:
- Headline: short paragraph in the top 5 that's not email/phone/url/name
- Summary: paragraph immediately after a "Summary"/"Profile"/"About"/"Objective" heading

## Response headers (DOCX + PDF endpoints)

- `X-Resume-Master-Format` — `pdf` or `docx`
- `X-Resume-Render-Mode` — `edit` or `rebuild`
- `X-Resume-Parse-Confidence` — `high` / `medium` / `low` (rebuild only)
- `X-Resume-Bullets-Applied` — count of bullets successfully rewritten
- `X-Resume-Bullets-Unmatched` — count of unmatched rewrites (surfaced as Highlights for rebuild; surfaced as warning toast for edit)

The ReviewPanel toast surfaces unmatched-bullet count and low-confidence parses.

## Deployment caveats

**PDF on Vercel serverless.** `render-pdf.ts` uses Playwright. On Vercel
serverless this needs `@sparticuz/chromium` or similar — without it the PDF
endpoint returns 500 with a clear error. Three options:

1. Add `@sparticuz/chromium` and configure the route's runtime per Vercel docs
2. Run the export endpoint on a non-Vercel host (Render, Fly, self-hosted)
3. Defer PDF; ship DOCX-only

DOCX export (both rebuild and edit) has no native deps and works anywhere.

**Existing UploadThing files.** Old PDF-only resumes already in the system
remain on the PDF rebuild path — no migration needed. New uploads can choose
PDF or DOCX going forward.

## Phase C scope (next)

- Apply the same render pipeline to **cover letters** (DOCX + PDF download)
- Persist cover letter edits (PRD §5: "Cover letter editing is client-side only")
  via existing `PATCH /api/applications/[id]` route
- Optional: `Application.resumePack` Json cache field to avoid duplicate AI
  calls across Resume Pack regenerations
- Optional: multiple template styles for the rebuild path
- Optional: per-bullet "regenerate this one" button in the Resume Pack UI

## Smoke test (manual)

1. `npm run dev`
2. Upload a master resume (PDF or DOCX) in the Resumes section
3. Open a PREPARED application's Review Panel
4. Click **Resume Pack** tab → **Generate Resume Pack**
5. Click **Download .docx** — verify file downloads, opens in Word, content tailored
   - For DOCX masters: the layout should be your exact original layout with bullets swapped
   - For PDF masters: a clean neutral template with your content
6. Click **Download .pdf** — same content as PDF (requires Playwright chromium)

## Known limitations

- PDF parsing is heuristic. Multi-column layouts, image-heavy resumes, and
  non-standard headings parse with reduced fidelity. Toast warns when low.
- DOCX surgical edit relies on text matching against the master. If the AI
  returns a heavily summarized "original" or the master has unusual run
  splits, matching may miss. Misses surface as "unmatched" warning toast.
- Per-character formatting within a bullet (e.g. one bold word inside a
  sentence) collapses onto the first run's style after edit.
- Keywords from ResumePack are used by the AI when rewriting bullets;
  they are **not** auto-injected to avoid keyword stuffing.
