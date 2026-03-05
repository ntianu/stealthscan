import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  currentTitle: z.string().optional(),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
  skills: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  workAuth: z.string().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  githubUrl: z.string().url().nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
});

export async function GET() {
  const user = await requireUser();
  const profile = await db.userProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const data = schema.parse(body);

  const profile = await db.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return NextResponse.json(profile);
}
