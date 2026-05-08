import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ExportError } from "@/lib/export/pipeline";
import { buildCoverLetterInput } from "@/lib/export/cover-letter-pipeline";
import { renderCoverLetterDocx } from "@/lib/export/render-cover-letter-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/applications/[id]/export/cover-letter/docx
 *
 * Body (all optional): { body?: string }
 *
 * If `body` is supplied (e.g. unsaved edits), it's used instead of the
 * persisted Application.coverLetter. Returns a `.docx` file.
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
    const buffer = await renderCoverLetterDocx(letter);
    const filename = `${filenameStem || "cover-letter"}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ExportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[export/cover-letter/docx] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
