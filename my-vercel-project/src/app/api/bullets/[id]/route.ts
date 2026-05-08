import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const BULLET_CATEGORIES = ["achievement","leadership","technical","cross_functional","growth","stakeholder","data_driven","operational"] as const;

const updateSchema = z.object({
  content: z.string().min(1).optional(),
  competencyTags: z.array(z.string()).optional(),
  industryTags: z.array(z.string()).optional(),
  roleTags: z.array(z.string()).optional(),
  seniority: z.enum(["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"]).optional(),
  proofStrength: z.number().min(1).max(5).optional(),
  category: z.enum(BULLET_CATEGORIES).nullable().optional(),
  context: z.string().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const bullet = await db.bullet.findUnique({ where: { id, userId: user.id } });
  if (!bullet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data = updateSchema.parse(body);
  const updated = await db.bullet.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const bullet = await db.bullet.findUnique({ where: { id, userId: user.id } });
  if (!bullet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.bullet.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
