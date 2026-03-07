import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/cron/run-scan";

function verifyCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runScan();
  return NextResponse.json(result);
}
