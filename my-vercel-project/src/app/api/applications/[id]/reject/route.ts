import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id, userId: user.id },
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Accept optional rejection reason from body
  let decisionReason: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.reason === "string" && body.reason.trim()) {
      decisionReason = body.reason.trim();
    }
  } catch {
    // no body — fine, reason is optional
  }

  await db.application.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewCompletedAt: new Date(),
      ...(decisionReason && { decisionReason }),
    },
  });

  return NextResponse.json({ status: "REJECTED" });
}
