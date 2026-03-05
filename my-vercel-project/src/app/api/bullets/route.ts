import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createBulletSchema = z.object({
  content: z.string().min(1),
  competencyTags: z.array(z.string()).default([]),
  industryTags: z.array(z.string()).default([]),
  roleTags: z.array(z.string()).default([]),
  seniority: z.enum(["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"]).default("MID"),
  proofStrength: z.number().min(1).max(5).default(3),
});

export async function GET() {
  const user = await requireUser();
  const bullets = await db.bullet.findMany({
    where: { userId: user.id },
    orderBy: [{ proofStrength: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(bullets);
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const data = createBulletSchema.parse(body);
  const bullet = await db.bullet.create({ data: { ...data, userId: user.id } });
  return NextResponse.json(bullet, { status: 201 });
}
