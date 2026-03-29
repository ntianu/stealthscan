import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id, userId: user.id },
    include: { job: true, resume: true, proof: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function PATCH(
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

  const body = await req.json();
  const { coverLetter, customAnswers, notes, status, interviewDate } = body;

  const ALLOWED_STATUSES = ["PREPARED", "APPROVED", "SUBMITTED", "REJECTED", "RESPONDED", "INTERVIEWING", "OFFER"];

  const updated = await db.application.update({
    where: { id },
    data: {
      ...(coverLetter !== undefined ? { coverLetter } : {}),
      ...(customAnswers !== undefined ? { customAnswers } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status !== undefined && ALLOWED_STATUSES.includes(status) ? { status } : {}),
      ...(interviewDate !== undefined ? { interviewDate: interviewDate ? new Date(interviewDate) : null } : {}),
      ...(status === "SUBMITTED" && application.status !== "SUBMITTED" ? { submittedAt: new Date() } : {}),
      ...(status === "RESPONDED" && application.status !== "RESPONDED" ? { responseAt: new Date() } : {}),
    },
  });

  return NextResponse.json(updated);
}
