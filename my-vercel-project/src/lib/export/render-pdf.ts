/**
 * Render a MergedResume to a PDF buffer.
 *
 * Approach: build an HTML+CSS document with the resume content, then
 * use Playwright (already a dep for scraping) to render it to PDF.
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

/** Generate a PDF buffer from a merged resume. */
export async function renderResumePdf(resume: MergedResume): Promise<Buffer> {
  const html = renderResumeHtml(resume);

  // Dynamic import so build doesn't fail in environments without chromium binaries.
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
      format: "Letter",
      margin: { top: "0.5in", right: "0.6in", bottom: "0.5in", left: "0.6in" },
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
