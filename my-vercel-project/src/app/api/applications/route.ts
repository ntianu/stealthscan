import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");

  const applications = await db.application.findMany({
    where: {
      userId: user.id,
      ...(status ? { status: status as never } : {}),
    },
    include: { job: true, resume: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(applications);
}
