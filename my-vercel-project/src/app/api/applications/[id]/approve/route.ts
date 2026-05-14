import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildApplyKit, submitToGreenhouse, submitToLever } from "@/lib/submission/kit-builder";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id, userId: user.id },
    include: { job: true, resume: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (application.status !== "PREPARED") {
    return NextResponse.json(
      { error: "Application is not in PREPARED status" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  // Allow overriding cover letter or answers from the review UI
  const coverLetter = body.coverLetter ?? application.coverLetter;
  const customAnswers = body.customAnswers ?? application.customAnswers;

  const source = application.job.source;

  // For Greenhouse and Lever: attempt API submission
  if ((source === "GREENHOUSE" || source === "LEVER") && application.resume) {
    const nameParts = (user.name ?? "").split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "";

    let result: { success: boolean; confirmationId?: string; error?: string };

    if (source === "GREENHOUSE") {
      // Extract company slug from the job's applyUrl
      const slugMatch = application.job.applyUrl.match(
        /greenhouse\.io\/(.+?)\/jobs/
      );
      const companySlug = slugMatch?.[1] ?? application.job.company.toLowerCase();

      result = await submitToGreenhouse({
        jobId: application.job.externalId,
        companySlug,
        firstName,
        lastName,
        email: user.email,
        resumeUrl: application.resume.fileUrl,
        coverLetter: coverLetter ?? undefined,
        answers: (customAnswers as Record<string, string>) ?? undefined,
      });
    } else {
      // Lever
      result = await submitToLever({
        postingId: application.job.externalId,
        companySlug: application.job.company.toLowerCase().replace(/\s+/g, ""),
        name: user.name ?? user.email,
        email: user.email,
        resumeUrl: application.resume.fileUrl,
        coverLetter: coverLetter ?? undefined,
      });
    }

    if (result.success) {
      // Create proof packet and mark submitted
      await db.$transaction([
        db.application.update({
          where: { id },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            reviewCompletedAt: new Date(),
            coverLetter,
            customAnswers,
          },
        }),
        db.applicationProof.create({
          data: {
            applicationId: id,
            jobSnapshot: application.job as never,
            resumeSnapshot: application.resume.fileUrl,
            coverLetterText: coverLetter,
            answersSnapshot: customAnswers as never,
            verifierReport: (application.verifierReport as never) ?? {},
          },
        }),
      ]);

      return NextResponse.json({ status: "SUBMITTED", confirmationId: result.confirmationId });
    } else {
      // API submission failed — fall through to Kit mode
      console.error("API submission failed:", result.error);
    }
  }

  // For all other sources (or API failures): return an Apply Kit
  await db.application.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewCompletedAt: new Date(),
      coverLetter,
      customAnswers,
    },
  });

  const kit = buildApplyKit({ ...application, job: application.job, resume: application.resume });

  return NextResponse.json({ status: "APPROVED", kit });
}
