import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Accept a URL string, an empty string (treated as null), or null/undefined.
// This prevents Zod from rejecting partial URLs like "linkedin.com/in/user".
const urlField = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v))
  .pipe(z.string().url().nullable())
  .nullable()
  .optional();

const schema = z.object({
  currentTitle: z.string().optional(),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
  skills: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  workAuth: z.string().optional(),
  linkedinUrl: urlField,
  githubUrl: urlField,
  portfolioUrl: urlField,
});

export async function GET() {
  const user = await requireUser();
  const profile = await db.userProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = parsed.data;
  const profile = await db.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return NextResponse.json(profile);
}
