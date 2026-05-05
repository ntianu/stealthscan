# Handoff — Resume Export Pipeline

**Started:** 2026-05-05
**Branch:** `claude/elastic-wescoff`
**Author:** Cowork session (working alongside Claude Code on this worktree)

## What this is

A new pipeline for generating tailored resume DOCX/PDF files from the existing
`generateResumePack()` AI output. Closes the "Resume Pack UI not wired" gap
called out in PRD §5 and §8.1, plus extends to PDF output.

User decision (via Cowork): support **all three** render paths —
DOCX surgical edits when the master is .docx, fall back to a clean DOCX
template when the master is .pdf, and offer PDF download as a third option.
Also: extract full structure from the master (not just ResumePack content)
so the output is a complete resume, not a "highlights" doc.

## Phasing

| Phase | Scope | Status |
|-------|-------|--------|
| **A** | PDF master → clean DOCX template + PDF | **In progress (this push)** |
| B | DOCX master support + surgical edits | Not started |
| C | Cover letter export + persistence + polish | Not started |

## Files added in this push

| Path | Purpose |
|------|---------|
| `src/lib/export/types.ts` | Format-agnostic `ResumeStructure` + merge result types |
| `src/lib/export/parse-pdf.ts` | PDF master → `ResumeStructure` (heuristic, text-based) |
| `src/lib/export/merge.ts` | Apply ResumePack rewrites onto a `ResumeStructure` |
| `package.json` (modified) | Added `docx`, `pdf-parse`, `@types/pdf-parse` |

**Action required before next session:** `npm install` to pick up the new deps.

## Files NOT yet added (Phase A remaining)

| Path | Purpose |
|------|---------|
| `src/lib/export/render-docx.ts` | Render `ResumeStructure` → DOCX buffer (using `docx` lib) |
| `src/lib/export/render-pdf.ts` | Render `ResumeStructure` → PDF buffer (HTML → Playwright) |
| `src/app/api/applications/[id]/export/docx/route.ts` | API endpoint, returns DOCX |
| `src/app/api/applications/[id]/export/pdf/route.ts` | API endpoint, returns PDF |
| `src/components/applications/review-panel.tsx` (modified) | Add download buttons |

## Architectural notes for whoever continues this

- **ResumePack stays JSON.** The existing `/api/applications/[id]/resume-pack`
  POST endpoint is unchanged. It still generates and returns the structured
  pack, and persists bullet variants. The new export endpoints will fetch
  (or accept in body) a ResumePack and feed it through the merger + renderer.
- **Master is fetched server-side.** Resume.fileUrl points at UploadThing. The
  export endpoints need to fetch that URL with `fetch()` and pass the buffer
  to `parsePdfMaster()`. Application has `resumeId?` — fall back to user's
  default Resume if null.
- **PDF parsing is heuristic.** `parsePdfMaster()` returns a confidence rating
  and warnings. When confidence is "low" (no experience section detected),
  the renderer should still produce a usable doc using ResumePack content
  alone, but flag it to the UI.
- **Unmatched bullet rewrites get a "Highlights" section.** The merger tries
  to match each `pack.bullets[].original` back to a bullet in the parsed
  master. Misses are spilled into a synthetic "Highlights" section so AI
  rewrites are never silently lost. The renderer should render this section.
- **No DB schema change in Phase A.** Phase C may add an `Application.resumePack`
  Json field for caching, but that's deferred.

## Phase B / C scope (not in this push)

**Phase B:**
- Update `resumeUploader.tsx` to accept `.docx` (currently hardcoded to `.pdf`)
- Update UploadThing config for the docx mime type
- Add `src/lib/export/parse-docx.ts` + `render-docx-edit.ts` (surgical edit of master)
- Branch in render endpoint: master format determines edit-vs-template path

**Phase C:**
- Apply the same render pipeline to cover letters
- Persist cover letter edits (PRD §5: "Cover letter editing is client-side only")
  via existing PATCH `/api/applications/[id]` route
- Optional: `Application.resumePack` Json cache field
- Optional: multiple template styles

## How to test (once Phase A is complete)

1. Ensure a user has a master Resume uploaded and at least one Application
   with `status = PREPARED` and ResumePack already generated.
2. Hit `POST /api/applications/{id}/export/docx` — expect a `.docx` download.
3. Hit `POST /api/applications/{id}/export/pdf` — expect a `.pdf` download.
4. Open both in Word/Preview; verify headline and bullet rewrites appear,
   structure looks like the master, and unmatched rewrites surface as
   a "Highlights" section.

## Known limitations (intentional, document them somewhere user-facing)

- PDF→structure parsing is heuristic. Resumes with multi-column layouts,
  graphical elements, or non-standard headings may parse with reduced fidelity.
- Phase A renders into a single neutral template. Users wanting their exact
  layout preserved should re-upload as DOCX once Phase B ships.
- Keywords from ResumePack are used by the AI when rewriting bullets;
  they are **not** auto-injected into the rendered output to avoid keyword
  stuffing.
