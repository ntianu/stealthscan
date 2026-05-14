import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  approved: z.boolean().optional(),
  content: z.string().min(1).optional(),
});

/**
 * PATCH /api/bullets/[id]/variants/[variantId]
 * Toggle approval or edit the content of a BulletVariant.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const user = await requireUser();
  const { id: bulletId, variantId } = await params;

  // Verify ownership via the parent bullet
  const bullet = await db.bullet.findUnique({
    where: { id: bulletId, userId: user.id },
    select: { id: true },
  });
  if (!bullet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const variant = await db.bulletVariant.findUnique({
    where: { id: variantId, bulletId },
  });
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const body = await req.json();
  const data = patchSchema.parse(body);

  const updated = await db.bulletVariant.update({
    where: { id: variantId },
    data: {
      ...(data.approved !== undefined ? { approved: data.approved } : {}),
      ...(data.content !== undefined
        ? { content: data.content, source: "USER_EDITED" }
        : {}),
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/bullets/[id]/variants/[variantId]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const user = await requireUser();
  const { id: bulletId, variantId } = await params;

  const bullet = await db.bullet.findUnique({
    where: { id: bulletId, userId: user.id },
    select: { id: true },
  });
  if (!bullet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.bulletVariant.deleteMany({ where: { id: variantId, bulletId } });
  return NextResponse.json({ deleted: true });
}
