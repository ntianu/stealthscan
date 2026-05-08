import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createResumeSchema = z.object({
  name: z.string().min(1),
  fileUrl: z.string().url(),
  fileKey: z.string().min(1),
  roleTags: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  seniority: z.enum(["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"]),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(resumes);
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const data = createResumeSchema.parse(body);

  // If setting as default, unset all others first
  if (data.isDefault) {
    await db.resume.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const resume = await db.resume.create({ data: { ...data, userId: user.id } });
  return NextResponse.json(resume, { status: 201 });
}
