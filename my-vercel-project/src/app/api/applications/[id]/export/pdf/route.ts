import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildExportArtifact, ExportError } from "@/lib/export/pipeline";
import { renderResumePdf } from "@/lib/export/render-pdf";
import type { ResumePackInput } from "@/lib/export/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/applications/[id]/export/pdf
 *
 * Body (all optional): { pack?: ResumePackInput }
 *
 * PDF rendering always goes through the rebuild path: even when the master
 * is DOCX, we parse to ResumeStructure and render a fresh PDF rather than
 * round-tripping DOCX → PDF (which would require a server-side Word/LibreOffice).
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
    const artifact = await buildExportArtifact({
      userId: user.id,
      applicationId: id,
      pack,
      preferEdit: false, // PDF always wants a parsed structure
    });

    if (artifact.kind !== "rebuild") {
      // Defensive: pipeline should always return rebuild when preferEdit=false
      throw new ExportError("Internal: PDF export requires a parsed structure.", 500);
    }

    const buffer = await renderResumePdf(artifact.merged.resume);
    const filename = `${artifact.filenameStem || "resume"}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
        "X-Resume-Master-Format": artifact.masterFormat,
        "X-Resume-Render-Mode": "rebuild",
        "X-Resume-Parse-Confidence": artifact.merged.resume.meta.parseConfidence,
        "X-Resume-Bullets-Applied": String(artifact.merged.appliedBullets.length),
        "X-Resume-Bullets-Unmatched": String(artifact.merged.unmatchedBullets.length),
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
