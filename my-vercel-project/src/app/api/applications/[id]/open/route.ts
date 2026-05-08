import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/applications/[id]/open
 * Records when a user first opens the review panel for an application.
 * Only sets reviewOpenedAt once (idempotent).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id, userId: user.id },
    select: { id: true, reviewOpenedAt: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only set once — don't overwrite if already recorded
  if (!application.reviewOpenedAt) {
    await db.application.update({
      where: { id },
      data: { reviewOpenedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
