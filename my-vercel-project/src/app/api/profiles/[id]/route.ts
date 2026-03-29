import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  dailyLimit: z.number().min(1).max(50).optional(),
  titleIncludes: z.array(z.string()).optional(),
  titleExcludes: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  remoteTypes: z.array(z.enum(["REMOTE", "HYBRID", "ONSITE"])).optional(),
  minSalary: z.number().nullable().optional(),
  maxSalary: z.number().nullable().optional(),
  seniority: z.array(z.enum(["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"])).optional(),
  jobTypes: z.array(z.enum(["FULLTIME","PARTTIME","CONTRACT","FREELANCE","INTERNSHIP"])).optional(),
  industries: z.array(z.string()).optional(),
  companyBlacklist: z.array(z.string()).optional(),
  companyWhitelist: z.array(z.string()).optional(),
  sources: z.array(z.enum(["LINKEDIN","INDEED","WTTJ","GREENHOUSE","LEVER","REMOTIVE","WEWORKREMOTELY","HACKERNEWS","JOBICY","WORKINGNOMADS","RSS","BUILTIN"])).optional(),
  rssFeeds: z.array(z.string().url()).optional(),
  linkedinSearchUrls: z.array(z.string().url()).optional(),
  autoApply: z.boolean().optional(),
  autoApplyThreshold: z.number().min(0).max(1).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const profile = await db.searchProfile.findUnique({ where: { id, userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const existing = await db.searchProfile.findUnique({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data = updateSchema.parse(body);
  const updated = await db.searchProfile.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const existing = await db.searchProfile.findUnique({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.searchProfile.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
