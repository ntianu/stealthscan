import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAutoApply } from "@/lib/auto-apply";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

/**
 * GET /api/cron/auto-apply
 * Runs auto-apply for all users who have at least one active SearchProfile
 * with autoApply=true. Call this after the scan cron completes.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all users with at least one active auto-apply profile
  const userIds = await db.searchProfile
    .findMany({
      where: { active: true, autoApply: true },
      select: { userId: true },
      distinct: ["userId"],
    })
    .then((rows: { userId: string }[]) => rows.map((r) => r.userId));

  const results = await Promise.allSettled(
    userIds.map((userId: string) => runAutoApply(userId))
  );

  const summary = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { userId: userIds[i], error: String((r as PromiseRejectedResult).reason) }
  );

  return NextResponse.json({ users: userIds.length, results: summary });
}
