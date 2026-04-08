import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id, userId: user.id },
    include: { job: { select: { title: true, company: true } } },
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
    // no body — fine
  }

  await db.application.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewCompletedAt: new Date(),
      ...(decisionReason && { decisionReason }),
    },
  });

  // Auto-append to decision_log context document (non-fatal)
  if (decisionReason && application.job) {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const entry = `\n## ${today} — Skipped: ${application.job.title} at ${application.job.company}\nReason: ${decisionReason}\n`;

      const existing = await db.contextDocument.findUnique({
        where: { userId_type: { userId: user.id, type: "decision_log" } },
        select: { content: true },
      });

      const updatedContent = existing
        ? existing.content + entry
        : `# Decision Log\n${entry}`;

      // Compile for prompt injection
      const compiled = updatedContent
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/^\s*[-*+]\s+/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      await db.contextDocument.upsert({
        where: { userId_type: { userId: user.id, type: "decision_log" } },
        create: {
          userId: user.id,
          type: "decision_log",
          title: "Decision Log",
          content: updatedContent,
          compiled,
          compiledAt: new Date(),
        },
        update: {
          content: updatedContent,
          compiled,
          compiledAt: new Date(),
        },
      });
    } catch (err) {
      // Non-fatal: log and continue
      console.warn("[reject] failed to append to decision_log:", err);
    }
  }

  return NextResponse.json({ status: "REJECTED" });
}
