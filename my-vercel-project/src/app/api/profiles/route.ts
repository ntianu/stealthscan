import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createProfileSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  dailyLimit: z.number().min(1).max(50).default(20),
  titleIncludes: z.array(z.string()).default([]),
  titleExcludes: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remoteTypes: z.array(z.enum(["REMOTE", "HYBRID", "ONSITE"])).default([]),
  minSalary: z.number().nullable().default(null),
  maxSalary: z.number().nullable().default(null),
  seniority: z.array(z.enum(["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"])).default([]),
  jobTypes: z.array(z.enum(["FULLTIME","PARTTIME","CONTRACT","FREELANCE","INTERNSHIP"])).default([]),
  industries: z.array(z.string()).default([]),
  companyBlacklist: z.array(z.string()).default([]),
  companyWhitelist: z.array(z.string()).default([]),
  sources: z.array(z.enum(["LINKEDIN","INDEED","WTTJ","GREENHOUSE","LEVER","REMOTIVE","WEWORKREMOTELY","HACKERNEWS","JOBICY","WORKINGNOMADS"])).default([]),
});

export async function GET() {
  const user = await requireUser();
  const profiles = await db.searchProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const data = createProfileSchema.parse(body);

  const profile = await db.searchProfile.create({
    data: { ...data, userId: user.id },
  });
  return NextResponse.json(profile, { status: 201 });
}
