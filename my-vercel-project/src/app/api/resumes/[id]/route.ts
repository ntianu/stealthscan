import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const resume = await db.resume.findUnique({ where: { id, userId: user.id } });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Soft delete
  await db.resume.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const resume = await db.resume.findUnique({ where: { id, userId: user.id } });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.isDefault) {
    await db.resume.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  const updated = await db.resume.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}
