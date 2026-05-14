/**
 * PDF rendering utilities backed by Playwright.
 *
 * Two entry points:
 *   - htmlToPdf(html)        — generic HTML → PDF buffer
 *   - renderResumePdf(resume) — convenience wrapper for MergedResume
 *
 * Deployment note: Playwright on Vercel serverless requires
 * `@sparticuz/chromium` or a similar headless-chrome binary. On standard
 * Node hosts (Render, Fly, self-hosted, local dev) `playwright` works
 * out of the box once `npx playwright install chromium` has been run.
 *
 * We dynamically import playwright so the module loads even when chromium
 * isn't available — the error is raised only when the function is called.
 */

import type { MergedResume } from "./types";
import { renderResumeHtml } from "./render-html";

export interface HtmlToPdfOptions {
  /** Page format (default: Letter). */
  format?: "Letter" | "A4";
  /** Page margins. CSS-style strings like "0.5in" or "20mm". */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  /** Whether to render print backgrounds. Default: true (preserves CSS bg colors). */
  printBackground?: boolean;
}

/** Generic HTML → PDF helper. Used by both resume and cover letter renderers. */
export async function htmlToPdf(
  html: string,
  opts: HtmlToPdfOptions = {}
): Promise<Buffer> {
  let chromium;
  try {
    const mod = await import("playwright");
    chromium = mod.chromium;
  } catch (err) {
    throw new Error(
      `Playwright not available: ${err instanceof Error ? err.message : String(err)}. ` +
        `Install with 'npx playwright install chromium' or configure '@sparticuz/chromium' for serverless.`
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: opts.format ?? "Letter",
      margin: {
        top: opts.margin?.top ?? "0.5in",
        right: opts.margin?.right ?? "0.6in",
        bottom: opts.margin?.bottom ?? "0.5in",
        left: opts.margin?.left ?? "0.6in",
      },
      printBackground: opts.printBackground ?? true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/** Generate a PDF buffer from a merged resume. */
export async function renderResumePdf(resume: MergedResume): Promise<Buffer> {
  const html = renderResumeHtml(resume);
  return htmlToPdf(html);
}
