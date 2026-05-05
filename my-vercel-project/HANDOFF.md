# Handoff — Resume Export Pipeline

**Branch:** `claude/elastic-wescoff`
**Author:** Cowork session (working alongside Claude Code on this worktree)

## What this is

A new pipeline for generating tailored resume DOCX/PDF files from the existing
`generateResumePack()` AI output. Closes the "Resume Pack UI not wired" gap
called out in PRD §5 and §8.1, and extends to PDF output.

User decision (via Cowork): support **all three** render paths —
DOCX surgical edits when the master is .docx, fall back to a clean DOCX
template when the master is .pdf, and offer PDF download as a third option.
Also: extract full structure from the master so the output is a complete
resume, not a "highlights" doc.

## Phasing

| Phase | Scope | Status |
|-------|-------|--------|
| **A** | PDF master → clean DOCX template + PDF | **✅ Complete** |
| B | DOCX master support + surgical edits | Not started |
| C | Cover letter export + persistence + polish | Not started |

## Phase A — what shipped

### Files added (Phase A)

| Path | Purpose |
|------|---------|
| `src/lib/export/types.ts` | Format-agnostic `ResumeStructure` + merge result types |
| `src/lib/export/parse-pdf.ts` | PDF master → `ResumeStructure` (heuristic, text-based via `pdf-parse`) |
| `src/lib/export/merge.ts` | Apply ResumePack rewrites onto a `ResumeStructure` |
| `src/lib/export/render-docx.ts` | `MergedResume` → DOCX buffer (`docx` v9 lib, neutral template) |
| `src/lib/export/render-html.ts` | `MergedResume` → self-contained HTML (drives PDF + future preview) |
| `src/lib/export/render-pdf.ts` | HTML → PDF via Playwright |
| `src/lib/export/pipeline.ts` | End-to-end glue: load master → parse → merge (+ optional pack regen) |
| `src/app/api/applications/[id]/export/docx/route.ts` | `POST` → returns `.docx` |
| `src/app/api/applications/[id]/export/pdf/route.ts` | `POST` → returns `.pdf` |

### Files modified

| Path | Change |
|------|--------|
| `package.json` | Added `docx@^9.5.0`, `pdf-parse@^1.1.1`, `@types/pdf-parse@^1.1.4` |
| `src/components/applications/review-panel.tsx` | Added "Download .docx" + "Download .pdf" buttons inside the Resume Pack tab. Buttons reuse the in-memory pack to avoid duplicate AI calls. |

## Verification done in-session

- `npx tsc --noEmit` → exit 0, no new errors
- `npm run lint` → 5 pre-existing errors in `review-panel.tsx` (lines 703, 713 — unescaped `"` in `{s.signal}`) and `dashboard/page.tsx` (line 38 — `Function` type). **None introduced by this push.**
- `npm install` ran cleanly (added 36 packages including `docx` and `pdf-parse`)

## How the export flow works

1. User opens an application's Review Panel.
2. User clicks **"Generate Resume Pack"** → existing `/api/applications/[id]/resume-pack`
   POST returns a structured pack (headline, summary, rewritten bullets, keywords, notes).
3. Pack is held in component state.
4. User clicks **"Download .docx"** or **"Download .pdf"** → POST to
   `/api/applications/[id]/export/{format}` with `{ pack }` in body.
5. Endpoint loads the master Resume from UploadThing, parses to `ResumeStructure`,
   merges in the pack, renders to the chosen format, streams back the file.
6. Browser triggers download. Toast surfaces parse confidence + unmatched-bullet count
   so users know if anything degraded.

## Architectural notes

- **ResumePack stays JSON.** The existing `/api/applications/[id]/resume-pack`
  POST is unchanged. It still generates the structured pack and persists bullet
  variants. The export endpoints can also regenerate the pack themselves if
  the body omits `pack` — useful for direct curl usage or future scheduled exports.
- **Master is fetched server-side.** Application has `resumeId?` —
  fall back to user's default `Resume`, then most recent active.
- **PDF parsing is heuristic.** `parsePdfMaster()` returns confidence + warnings.
  The export response sets `X-Resume-Parse-Confidence` and `X-Resume-Bullets-Unmatched`
  headers; the UI surfaces these via toast.
- **Unmatched bullet rewrites get a "Highlights" section.** The merger tries
  to match each `pack.bullets[].original` back to a bullet in the parsed master.
  Misses are spilled into a synthetic "Highlights" section so AI rewrites are
  never silently lost.
- **No DB schema change in Phase A.** The pack is passed through component state.
  Phase C may add `Application.resumePack` JSON for caching across sessions.

## Deployment caveat — PDF on Vercel serverless

`render-pdf.ts` uses Playwright (already a dep). Playwright on Vercel serverless
requires `@sparticuz/chromium` or similar; without it, the PDF endpoint will
return 500 with a clear error message. Three options to ship PDF in production:

1. Add `@sparticuz/chromium` and configure the route's runtime per Vercel's docs.
2. Run the export endpoint on a non-Vercel host (Render, Fly, self-hosted).
3. Defer PDF; ship DOCX-only initially. (DOCX rendering has no native deps.)

DOCX export works on any Node runtime including Vercel — no extra config needed.

## Phase B / C scope (not in this push)

**Phase B:**
- Update `resume-uploader.tsx` to accept `.docx` (currently hardcoded to `.pdf`)
- Update UploadThing config for the docx mime type
- Add `src/lib/export/parse-docx.ts` + `render-docx-edit.ts` (surgical edit of master)
- Branch in `pipeline.ts`: master format determines edit-vs-template path
  (the `isDocx` branch in `pipeline.ts` currently throws 501)

**Phase C:**
- Apply the same render pipeline to cover letters
- Persist cover letter edits (PRD §5: "Cover letter editing is client-side only")
  via existing `PATCH /api/applications/[id]` route
- Optional: `Application.resumePack` Json cache field
- Optional: multiple template styles

## How to test (manual smoke)

1. Run `npm run dev`.
2. Open an existing PREPARED application's Review Panel.
3. Click the **Resume Pack** tab.
4. Click **Generate Resume Pack** — should show headline, summary, bullets, keywords, notes.
5. Click **Download .docx** — file downloads, opens in Word with neutral template,
   contact block at top, summary, experience with bullets, education, skills.
6. Click **Download .pdf** — same content, PDF format. (Requires Playwright chromium
   binary — `npx playwright install chromium` if not already.)

### Known limitations (intentional, document somewhere user-facing)

- PDF→structure parsing is heuristic. Resumes with multi-column layouts,
  graphical elements, or non-standard headings may parse with reduced fidelity.
  The toast warns when confidence is "low".
- Phase A renders into a single neutral template. Users wanting their exact
  layout preserved should re-upload as DOCX once Phase B ships.
- Keywords from ResumePack are used by the AI when rewriting bullets;
  they are **not** auto-injected into the rendered output to avoid keyword stuffing.
- DOCX masters currently return 501 from the export endpoints. Phase B fixes this.
