import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const BULLET_CATEGORIES = ["achievement","leadership","technical","cross_functional","growth","stakeholder","data_driven","operational"] as const;

const createBulletSchema = z.object({
  content: z.string().min(1),
  competencyTags: z.array(z.string()).default([]),
  industryTags: z.array(z.string()).default([]),
  roleTags: z.array(z.string()).default([]),
  seniority: z.enum(["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"]).default("MID"),
  proofStrength: z.number().min(1).max(5).default(3),
  category: z.enum(BULLET_CATEGORIES).optional(),
  context: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();
  const bullets = await db.bullet.findMany({
    where: { userId: user.id },
    include: { variants: { orderBy: { createdAt: "desc" } } },
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
