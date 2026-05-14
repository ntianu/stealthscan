import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildExportArtifact, ExportError } from "@/lib/export/pipeline";
import { renderResumeDocx } from "@/lib/export/render-docx";
import { renderResumeDocxEdit } from "@/lib/export/render-docx-edit";
import type { ResumePackInput } from "@/lib/export/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/applications/[id]/export/docx
 *
 * Body (all optional): { pack?: ResumePackInput }
 *
 * Returns: a `.docx` file. When the master is a DOCX, we surgically edit
 * the original to preserve the user's exact layout. When the master is a
 * PDF, we render fresh into a clean template.
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
      preferEdit: true, // DOCX export prefers surgical edit when master is DOCX
    });

    let buffer: Buffer;
    let parseConfidence = "high";
    let bulletsApplied = 0;
    let bulletsUnmatched = 0;
    let editMode = false;

    if (artifact.kind === "edit") {
      const result = await renderResumeDocxEdit(
        artifact.originalBuffer,
        artifact.resolvedPack
      );
      buffer = result.buffer;
      bulletsApplied = result.appliedBulletCount;
      bulletsUnmatched = result.unmatchedBullets.length;
      editMode = true;
    } else {
      buffer = await renderResumeDocx(artifact.merged.resume);
      parseConfidence = artifact.merged.resume.meta.parseConfidence;
      bulletsApplied = artifact.merged.appliedBullets.length;
      bulletsUnmatched = artifact.merged.unmatchedBullets.length;
    }

    const filename = `${artifact.filenameStem || "resume"}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
        "X-Resume-Master-Format": artifact.masterFormat,
        "X-Resume-Render-Mode": editMode ? "edit" : "rebuild",
        "X-Resume-Parse-Confidence": parseConfidence,
        "X-Resume-Bullets-Applied": String(bulletsApplied),
        "X-Resume-Bullets-Unmatched": String(bulletsUnmatched),
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
