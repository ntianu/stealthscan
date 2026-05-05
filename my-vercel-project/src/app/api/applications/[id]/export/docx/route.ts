import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildMergedResume, ExportError } from "@/lib/export/pipeline";
import { renderResumeDocx } from "@/lib/export/render-docx";
import type { ResumePackInput } from "@/lib/export/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/applications/[id]/export/docx
 *
 * Body (all optional):
 *   { pack?: ResumePackInput }
 *
 * Returns: a `.docx` file. If `pack` is provided, the AI step is skipped
 * (cheap path). Otherwise the endpoint regenerates the pack via Anthropic
 * before merging.
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
    const buffer = await renderResumeDocx(merged.resume);

    const filename = `${merged.filenameStem || "resume"}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    console.error("[export/docx] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
