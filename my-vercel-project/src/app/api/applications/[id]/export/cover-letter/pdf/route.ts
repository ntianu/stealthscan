import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ExportError } from "@/lib/export/pipeline";
import { buildCoverLetterInput } from "@/lib/export/cover-letter-pipeline";
import { renderCoverLetterHtml } from "@/lib/export/render-cover-letter-html";
import { htmlToPdf } from "@/lib/export/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/applications/[id]/export/cover-letter/pdf
 *
 * Body (all optional): { body?: string }
 *
 * Returns a `.pdf` rendered via Playwright. Same caveats as the resume
 * PDF export — Vercel serverless requires `@sparticuz/chromium`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  let body: string | undefined;
  try {
    const json = (await req.json().catch(() => null)) as { body?: string } | null;
    if (typeof json?.body === "string") body = json.body;
  } catch {
    /* body is optional */
  }

  try {
    const { letter, filenameStem } = await buildCoverLetterInput({
      userId: user.id,
      applicationId: id,
      body,
    });
    const html = renderCoverLetterHtml(letter);
    const buffer = await htmlToPdf(html);
    const filename = `${filenameStem || "cover-letter"}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ExportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[export/cover-letter/pdf] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
