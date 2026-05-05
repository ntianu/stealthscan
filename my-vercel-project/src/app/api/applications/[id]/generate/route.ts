import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { answerCommonQuestions } from "@/lib/ai/answer-gen";
import { verifyGeneratedText } from "@/lib/ai/verifier";
import { selectBestResume, selectRelevantBullets } from "@/lib/ai/resume-select";
import { scoreJob } from "@/lib/matching/scorer";
import { analyzeJob, type JobIntel } from "@/lib/ai/job-intel";
import { assembleContext, jobIntelSlices, coverLetterSlices } from "@/lib/context/assemble";

/**
 * POST /api/applications/[id]/generate
 * Runs the full AI prep pipeline on an existing PREPARED application:
 *   1. Selects the best resume + relevant bullets
 *   2. Generates a cover letter (Claude Opus 4.6)
 *   3. Runs the verifier (no-hallucination check)
 *   4. Generates common ATS answers from profile
 *   5. Persists everything back to the application row
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  // Load the application with full relations
  const application = await db.application.findUnique({
    where: { id, userId: user.id },
    include: { job: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "PREPARED") {
    return NextResponse.json(
      { error: `Cannot regenerate content for a ${application.status} application` },
      { status: 400 }
    );
  }


  // Load user profile + resumes + bullets + career context in parallel
  const [userProfile, resumes, bullets, intelContext, coverContext] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.resume.findMany({ where: { userId: user.id } }),
    db.bullet.findMany({ where: { userId: user.id } }),
    assembleContext(user.id, jobIntelSlices()),
    assembleContext(user.id, coverLetterSlices()),
  ]);

  if (!userProfile) {
    return NextResponse.json(
      { error: "Complete your Professional Profile in Settings first." },
      { status: 400 }
    );
  }

  const job = application.job;

  // Select best resume and bullets for this job
  const bestResume = selectBestResume(resumes, {
    title: job.title,
    requirements: job.requirements,
    description: job.description,
  });
  const selectedBullets = selectRelevantBullets(
    bullets,
    { title: job.title, requirements: job.requirements, description: job.description },
    5
  );

  // Run job analysis first — this informs both bullet selection and cover letter
  let jobIntel: JobIntel | null = null;
  try {
    jobIntel = await analyzeJob({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      },
      userProfile: {
        currentTitle: userProfile.currentTitle,
        yearsExperience: userProfile.yearsExperience,
        skills: userProfile.skills,
        industries: userProfile.industries,
        linkedinAbout: userProfile.linkedinAbout,
      },
      bullets: selectedBullets.map((b) => ({
        id: b.id,
        content: b.content,
        competencyTags: b.competencyTags,
        roleTags: b.roleTags,
        proofStrength: b.proofStrength,
      })),
      careerContext: intelContext || undefined,
    });
  } catch (err) {
    console.warn("[generate] job analysis failed (non-fatal):", err);
  }

  // Generate cover letter (intel-informed if available)
  let coverLetterText = "";
  let tokensUsed = 0;
  try {
    const result = await generateCoverLetter({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      },
      userProfile: {
        currentTitle: userProfile.currentTitle,
        yearsExperience: userProfile.yearsExperience,
        skills: userProfile.skills,
        industries: userProfile.industries,
        linkedinAbout: userProfile.linkedinAbout,
      },
      resume: bestResume
        ? {
            name: bestResume.name,
            roleTags: bestResume.roleTags,
            domains: bestResume.domains,
            seniority: bestResume.seniority,
          }
        : { name: "Default Resume", roleTags: [], domains: [], seniority: "MID" },
      selectedBullets: selectedBullets.map((b) => ({
        content: b.content,
        competencyTags: b.competencyTags,
      })),
      jobIntel: jobIntel ?? undefined,
      careerContext: coverContext || undefined,
    });
    coverLetterText = result.text;
    tokensUsed = result.tokensUsed;
  } catch (err) {
    console.error("[generate] cover letter failed:", err);
    return NextResponse.json(
      { error: "Cover letter generation failed. Check ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  // Run verifier
  const verifierReport = verifyGeneratedText(
    coverLetterText,
    {
      currentTitle: userProfile.currentTitle,
      skills: userProfile.skills,
      yearsExperience: userProfile.yearsExperience,
    },
    selectedBullets,
    job.company
  );

  // Generate common ATS answers from profile
  const customAnswers = answerCommonQuestions(
    {
      yearsExperience: userProfile.yearsExperience,
      workAuth: userProfile.workAuth,
      currentTitle: userProfile.currentTitle,
      skills: userProfile.skills,
    },
    job.title
  );

  // Compute updated fit score with the selected resume
  const preferredSeniorities = await db.searchProfile
    .findMany({ where: { userId: user.id, active: true }, select: { seniority: true } })
    .then((profiles) => profiles.flatMap((p) => p.seniority));

  const fitResult = scoreJob(job, userProfile, preferredSeniorities);

  // Persist everything back to the application
  const updated = await db.application.update({
    where: { id },
    data: {
      coverLetter: coverLetterText,
      customAnswers: JSON.parse(JSON.stringify(customAnswers)),
      verifierReport: JSON.parse(JSON.stringify(verifierReport)),
      jobAnalysis: jobIntel ? JSON.parse(JSON.stringify(jobIntel)) : undefined,
      resumeId: bestResume?.id ?? application.resumeId,
      fitScore: fitResult.score,
      fitExplanation: fitResult.explanation,
      // v2 — persist intelligence fields when available
      ...(jobIntel && {
        confidenceBand: jobIntel.confidenceBand,
        rationale: jobIntel.rationale,
        risks: jobIntel.risks ?? null,
      }),
      // bullet library — record which bullets powered this application
      selectedBulletIds: selectedBullets.map((b) => b.id),
    },
  });

  return NextResponse.json({
    coverLetter: updated.coverLetter,
    customAnswers: updated.customAnswers,
    verifierReport: updated.verifierReport,
    jobAnalysis: updated.jobAnalysis,
    resumeId: updated.resumeId,
    fitScore: updated.fitScore,
    fitExplanation: updated.fitExplanation,
    confidenceBand: updated.confidenceBand,
    rationale: updated.rationale,
    risks: updated.risks,
    tokensUsed,
  });
}
