import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runScan } from "@/lib/cron/run-scan";
import { runPrepare } from "@/lib/cron/run-prepare";

/**
 * POST /api/scan
 * Auth-protected endpoint that runs scan → prepare in-process.
 * Calls the core logic functions directly instead of making HTTP requests
 * to the cron routes — this bypasses Vercel Deployment Protection which
 * blocks internal fetch calls with an SSO wall.
 */
export async function POST() {
  await requireUser(); // throws 401 if not signed in

  // Step 1 — scrape new jobs directly (no HTTP hop — avoids Vercel Deployment Protection)
  const scanData = await runScan();

  // Step 2 — run AI prep pipeline against freshly inserted jobs
  const prepData = await runPrepare();

  return NextResponse.json({
    scan: scanData,
    prepare: prepData,
  });
}
