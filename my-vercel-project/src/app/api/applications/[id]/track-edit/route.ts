import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/applications/[id]/track-edit
 * Increments the cover letter edit counter and marks it as edited.
 * Called (debounced) whenever the user changes the cover letter textarea.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  await db.application.updateMany({
    where: { id, userId: user.id },
    data: {
      coverLetterEdited: true,
      editCount: { increment: 1 },
    },
  });

  return NextResponse.json({ ok: true });
}
