import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  await requireUser();

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const source = searchParams.get("source");
  const remote = searchParams.get("remote");

  const jobs = await db.job.findMany({
    where: {
      status: "ACTIVE",
      ...(source ? { source: source as never } : {}),
      ...(remote ? { remoteType: remote as never } : {}),
    },
    orderBy: { fetchedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await db.job.count({ where: { status: "ACTIVE" } });

  return NextResponse.json({ jobs, total, page, limit });
}
