import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runScan } from "@/lib/cron/run-scan";

/**
 * POST /api/scan
 * Auth-protected endpoint that scrapes new jobs in-process.
 *
 * Prepare (AI cover letters) is intentionally excluded here — it calls
 * Claude per job and would exceed Vercel's 10s serverless timeout.
 * Prepare runs via the /api/cron/prepare-apps cron schedule instead.
 */
export async function POST() {
  await requireUser(); // throws 401 if not signed in

  const scanData = await runScan();

  return NextResponse.json({ scan: scanData, prepare: { prepared: 0 } });
}
