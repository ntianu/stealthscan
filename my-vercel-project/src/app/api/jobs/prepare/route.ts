import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreJob } from "@/lib/matching/scorer";
import { selectBestResume } from "@/lib/ai/resume-select";

/**
 * POST /api/jobs/prepare
 * Body: { jobId: string }
 *
 * Creates a PREPARED application for the given job, picking the best
 * matching resume from the user's library. No AI generation at this stage
 * (cover letter + answers are added by the cron or manually).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  const { jobId } = await req.json();

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  // Check if user already has an application for this job
  const existing = await db.application.findFirst({
    where: { userId: user.id, jobId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already in queue", applicationId: existing.id },
      { status: 409 }
    );
  }

  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Load user profile + search profiles for scoring
  const [userProfile, searchProfiles, resumes] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.searchProfile.findMany({ where: { userId: user.id, active: true } }),
    db.resume.findMany({ where: { userId: user.id, active: true } }),
  ]);

  // Compute fit score using best matching search profile seniorities
  const preferredSeniorities = searchProfiles.flatMap((p) => p.seniority);
  const uniqueSeniorities = [...new Set(preferredSeniorities)];

  const fitResult = userProfile
    ? scoreJob(job, userProfile, uniqueSeniorities)
    : { score: 0.5, explanation: "No profile set up yet", matchedSkills: [], missedSkills: [] };

  // Select best resume (signature: selectBestResume(resumes, job))
  const bestResume = resumes.length > 0 ? selectBestResume(resumes, job) : null;

  // Create the application
  const application = await db.application.create({
    data: {
      userId: user.id,
      jobId: job.id,
      resumeId: bestResume?.id ?? null,
      status: "PREPARED",
      fitScore: fitResult.score,
      fitExplanation: fitResult.explanation,
      // coverLetter and customAnswers will be added by AI pipeline or user
    },
  });

  return NextResponse.json({ applicationId: application.id }, { status: 201 });
}
