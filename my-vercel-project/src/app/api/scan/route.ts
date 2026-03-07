import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.CRON_SECRET ?? "";

/**
 * POST /api/scan
 * Auth-protected endpoint that triggers scan-jobs → prepare-apps in sequence.
 * Keeps the CRON_SECRET server-side.
 */
export async function POST() {
  await requireUser(); // throws 401 if not signed in

  const headers = { "x-cron-secret": SECRET };

  // Step 1 — scrape new jobs
  const scanRes = await fetch(`${BASE}/api/cron/scan-jobs`, { headers });
  const scanData = scanRes.ok ? await scanRes.json() : { error: await scanRes.text() };

  // Step 2 — run AI prep pipeline
  const prepRes = await fetch(`${BASE}/api/cron/prepare-apps`, { headers });
  const prepData = prepRes.ok ? await prepRes.json() : { error: await prepRes.text() };

  return NextResponse.json({
    scan: scanData,
    prepare: prepData,
  });
}
