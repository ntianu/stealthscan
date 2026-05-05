import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildMergedResume, ExportError } from "@/lib/export/pipeline";
import { renderResumePdf } from "@/lib/export/render-pdf";
import type { ResumePackInput } from "@/lib/export/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/applications/[id]/export/pdf
 *
 * Body (all optional):
 *   { pack?: ResumePackInput }
 *
 * Returns: a `.pdf` file. PDF rendering uses Playwright; on serverless hosts
 * lacking a chromium binary, this will return 500 with a clear error message
 * (see render-pdf.ts).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  let pack: ResumePackInput | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { pack?: ResumePackInput } | null;
    if (body?.pack) pack = body.pack;
  } catch {
    /* body is optional */
  }

  try {
    const merged = await buildMergedResume({ userId: user.id, applicationId: id, pack });
    const buffer = await renderResumePdf(merged.resume);

    const filename = `${merged.filenameStem || "resume"}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
        "X-Resume-Parse-Confidence": merged.resume.meta.parseConfidence,
        "X-Resume-Bullets-Applied": String(merged.appliedBullets.length),
        "X-Resume-Bullets-Unmatched": String(merged.unmatchedBullets.length),
      },
    });
  } catch (err) {
    if (err instanceof ExportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[export/pdf] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
