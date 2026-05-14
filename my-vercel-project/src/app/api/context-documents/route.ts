import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/context-documents — return all context documents for the current user
export async function GET() {
  const user = await requireUser();

  const docs = await db.contextDocument.findMany({
    where: { userId: user.id },
    orderBy: { type: "asc" },
  });

  return NextResponse.json(docs);
}
