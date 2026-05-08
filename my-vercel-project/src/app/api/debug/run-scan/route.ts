import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runScan } from "@/lib/cron/run-scan";

/**
 * GET /api/debug/run-scan
 * Runs the full scan and returns every detail — same as Run Scan button
 * but with the full debug array visible in the JSON response.
 */
export async function GET() {
  await requireUser();
  const result = await runScan();
  return NextResponse.json(result, { status: 200 });
}
