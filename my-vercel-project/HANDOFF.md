# Handoff — Resume + Cover Letter Export Pipeline

**Branch:** `claude/elastic-wescoff`
**Author:** Cowork session (working alongside Claude Code on this worktree)

## What this is

A full export pipeline turning Stealth Scan's AI-generated `ResumePack` and
cover letter text into downloadable DOCX and PDF files. Closes the
"Resume Pack UI not wired" gap from PRD §5/§8.1, the "Cover letter editing
is client-side only" bug from PRD §5, and adds DOCX surgical edits +
PDF rendering throughout.

## Phasing

| Phase | Scope | Status |
|-------|-------|--------|
| **A** | PDF master → clean DOCX template + PDF | ✅ |
| **B** | DOCX master support + surgical edits | ✅ |
| **C** | Cover letter export + persistence + polish | ✅ |

## Combined file inventory

### `src/lib/export/`
| File | Phase | Purpose |
|------|-------|---------|
| `types.ts` | A | `ResumeStructure`, `MergeResult`, `ResumePackInput` |
| `parse-pdf.ts` | A | PDF → `ResumeStructure` (heuristic) |
| `parse-docx.ts` | B | DOCX → `ResumeStructure` (used for PDF rendering when master is DOCX) |
| `merge.ts` | A | Apply `ResumePack` rewrites onto a `ResumeStructure` |
| `render-docx.ts` | A | `MergedResume` → DOCX (rebuild template, `docx` v9 lib) |
| `render-docx-edit.ts` | B | Surgical edit of master DOCX preserving layout |
| `render-html.ts` | A | `MergedResume` → self-contained HTML (drives PDF + future preview) |
| `render-pdf.ts` | A / C | `htmlToPdf()` helper + `renderResumePdf()` wrapper |
| `pipeline.ts` | A / B | `buildExportArtifact()` returning rebuild-or-edit discriminator |
| `cover-letter-types.ts` | C | `CoverLetterInput`, `CoverLetterSender`, `CoverLetterRecipient` |
| `cover-letter-pipeline.ts` | C | Assembles `CoverLetterInput` from an `Application` + `UserProfile` |
| `render-cover-letter-docx.ts` | C | Cover letter → DOCX (letterhead + body) |
| `render-cover-letter-html.ts` | C | Cover letter → HTML (drives PDF) |

### `src/app/api/applications/[id]/export/`
| Path | Phase | Purpose |
|------|-------|---------|
| `docx/route.ts` | A / B | Resume DOCX (rebuild for PDF master, surgical edit for DOCX master) |
| `pdf/route.ts` | A / B | Resume PDF (always rebuilt; for DOCX masters, parses then renders fresh) |
| `cover-letter/docx/route.ts` | C | Cover letter DOCX |
| `cover-letter/pdf/route.ts` | C | Cover letter PDF |

### Modified app files
| Path | Changes |
|------|---------|
| `package.json` | A: `docx`, `pdf-parse`, `@types/pdf-parse` · B: `jszip`, `fast-xml-parser` |
| `src/components/applications/review-panel.tsx` | A: resume download buttons. C: cover letter persistence (debounced PATCH), save-state indicator, cover letter download buttons. |
| `src/lib/uploadthing.ts` | B: accept DOCX MIME type alongside PDF |
| `src/components/resumes/resume-uploader.tsx` | B: accept `.docx`, update copy |

### Smoke tests
| Path | Phase | Purpose |
|------|-------|---------|
| `scripts/smoke-docx-edit.ts` | B | Build tiny DOCX → run surgical edit → assert text swapped, output is valid DOCX |
| `scripts/smoke-cover-letter.ts` | C | Render cover letter → DOCX + HTML → assert output valid + content present |

## Verification done in-session

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (project-wide) | exit 0, no errors |
| `eslint` on touched files | clean (the only project-level errors are 5 pre-existing ones I didn't author) |
| `npm install` for new deps | added 36 + 2 packages cleanly |
| `npx tsx scripts/smoke-docx-edit.ts` | ✓ all assertions passed (2 of 3 bullets matched, 1 unmatched flagged, headline + summary applied, output unzips + re-parses) |
| `npx tsx scripts/smoke-cover-letter.ts` | ✓ all assertions passed (5 paragraphs split correctly, DOCX valid, expected text present) |

## End-to-end flow

```
Master file (PDF or DOCX) on UploadThing
              │
              ▼
   pipeline.ts > buildExportArtifact({ preferEdit })
              │
   ┌──────────┴──────────┐
 Rebuild               Edit (DOCX master + preferEdit)
   │                       │
 parse-{pdf,docx} →     render-docx-edit
 merge →                (surgical XML rewrite)
 render-{docx,pdf}
   │                       │
   └──────────┬────────────┘
              ▼
       Buffer → API route → file download

Cover letter (independent):
   Application.coverLetter (text) + UserProfile contact + Job recipient
              │
   cover-letter-pipeline.ts > buildCoverLetterInput
              │
   render-cover-letter-{docx,html}
              │
   Buffer → API route → file download
```

## ReviewPanel UX changes

**Resume Pack tab.** Once a pack is generated, two new buttons under
"Download tailored resume": `.docx` and `.pdf`. They reuse the in-memory
pack (no extra AI call). Toast warns on low parse confidence and surfaces
unmatched-bullet count.

**Cover Letter tab.**
- Edits persist on a 1.5s debounce via existing `PATCH /api/applications/[id]`.
  Save-state indicator: `Saving…` / `Saved` / `Save failed`.
- Two new buttons: download `.docx` and `.pdf`. The current textarea contents
  are sent in the request body, so unsaved edits export correctly.

## Response headers (resume export endpoints)

- `X-Resume-Master-Format` — `pdf` or `docx`
- `X-Resume-Render-Mode` — `edit` or `rebuild`
- `X-Resume-Parse-Confidence` — `high` / `medium` / `low` (rebuild only)
- `X-Resume-Bullets-Applied` — count of bullets successfully rewritten
- `X-Resume-Bullets-Unmatched` — count of unmatched rewrites

## Deployment caveats

**PDF on Vercel serverless.** Both `renderResumePdf()` and the cover letter
PDF endpoint use Playwright via the shared `htmlToPdf()` helper. On Vercel
serverless this needs `@sparticuz/chromium` or similar — without it the PDF
endpoints return 500 with a clear error message. Three options:

1. Add `@sparticuz/chromium` and configure the route runtime per Vercel docs
2. Run the export endpoints on a non-Vercel host (Render, Fly, self-hosted)
3. Defer PDF; ship DOCX-only

DOCX export (resume rebuild, resume edit, and cover letter) has no native
deps and works on any Node runtime including Vercel.

**Existing UploadThing files.** Old PDF-only resumes already in the system
remain on the PDF rebuild path — no migration needed. New uploads can choose
PDF or DOCX going forward.

## Optional Phase C items deliberately deferred

These were called out as "optional" in the original Phase C scope and not
implemented. Each is a small follow-up if/when wanted:

- **`Application.resumePack` Json cache field.** Would let the ReviewPanel
  survive page reloads without regenerating the pack. Today the pack lives
  in component state and is lost on refresh. Requires a Prisma migration.
- **Multiple template styles** for the rebuild renderer (single-column vs.
  two-column, neutral vs. modern, etc.).
- **Per-bullet "regenerate this one" button** in the Resume Pack UI.
- **Cross-application pipeline / Kanban view** (`/applications/pipeline`).
  This was originally bundled with cover letter persistence in task #5;
  persistence shipped, the Kanban is its own piece of work.

## Known limitations

- PDF parsing is heuristic. Multi-column layouts, image-heavy resumes, and
  non-standard headings parse with reduced fidelity. Toast warns on low.
- DOCX surgical edit relies on text matching against the master. If the AI
  returns a heavily summarized "original" or the master has unusual run
  splits, matching may miss. Misses surface as a warning toast.
- Per-character formatting *within* a bullet (e.g. one bold word inside a
  sentence) collapses onto the first run's style after edit.
- Keywords from ResumePack are used by the AI when rewriting bullets;
  they are **not** auto-injected to avoid keyword stuffing.
- Cover letter sender contact uses `User.email` and `UserProfile.linkedinUrl`;
  phone and location aren't currently on the profile schema. Add them to
  `UserProfile` later if richer letterheads are wanted.

## Manual smoke (full system)

1. `npm run dev`
2. Upload a master resume (PDF or DOCX) in the Resumes section
3. Open a PREPARED application's Review Panel
4. **Cover Letter tab:**
   - Edit the textarea — watch for "Saving… → Saved"
   - Refresh the page — edits should persist
   - Click "Download .docx" — opens in Word with letterhead + body
   - Click "Download .pdf" — same content as PDF
5. **Resume Pack tab:**
   - Click **Generate Resume Pack**
   - Click **Download .docx** — DOCX master users get a surgically-edited
     copy of their original; PDF master users get a clean rebuild template
   - Click **Download .pdf** — fresh-rendered PDF in either case
