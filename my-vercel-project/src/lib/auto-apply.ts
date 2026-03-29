import { db } from "@/lib/db";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { answerCommonQuestions } from "@/lib/ai/answer-gen";
import { verifyGeneratedText } from "@/lib/ai/verifier";
import { selectBestResume, selectRelevantBullets } from "@/lib/ai/resume-select";
import { scoreJob } from "@/lib/matching/scorer";

export interface AutoPrepResult {
  userId: string;
  processed: number;
  prepared: number;  // generated + stays in queue for human review
  skipped: number;   // already has content or below threshold
  errors: number;
  log: string[];
}

/**
 * Pre-generates cover letters and ATS answers for PREPARED applications that
 * meet the auto-apply threshold. Applications stay in PREPARED status —
 * a human still reviews and submits each one.
 */
export async function runAutoApply(userId: string): Promise<AutoPrepResult> {
  const result: AutoPrepResult = {
    userId,
    processed: 0,
    prepared: 0,
    skipped: 0,
    errors: 0,
    log: [],
  };

  // Check if any active search profile has auto-apply enabled
  const profiles = await db.searchProfile.findMany({
    where: { userId, active: true, autoApply: true },
    select: { autoApplyThreshold: true },
  });

  if (profiles.length === 0) {
    result.log.push("No active search profiles with auto-apply enabled.");
    return result;
  }

  // Use the lowest threshold across all auto-apply profiles
  const threshold = Math.min(...profiles.map((p: { autoApplyThreshold: number }) => p.autoApplyThreshold));

  // Load user profile + resumes + bullets once
  const [userProfile, resumes, bullets] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.resume.findMany({ where: { userId } }),
    db.bullet.findMany({ where: { userId } }),
  ]);

  if (!userProfile) {
    result.log.push("User profile not found — skipping.");
    return result;
  }

  // Find PREPARED applications above the threshold that don't have content yet
  const applications = await db.application.findMany({
    where: {
      userId,
      status: "PREPARED",
      fitScore: { gte: threshold },
      coverLetter: null,
    },
    include: { job: true },
    orderBy: { fitScore: "desc" },
  });

  result.log.push(`Found ${applications.length} application(s) to pre-generate at or above ${Math.round(threshold * 100)}% threshold.`);

  const preferredSeniorities = await db.searchProfile
    .findMany({ where: { userId, active: true }, select: { seniority: true } })
    .then((ps: { seniority: string[] }[]) => ps.flatMap((p) => p.seniority) as import("@prisma/client").Seniority[]);

  for (const application of applications) {
    result.processed++;
    const job = application.job;

    try {
      // Select resume + bullets
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

      // Generate cover letter
      const { text: coverLetterText } = await generateCoverLetter({
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
        },
        resume: bestResume
          ? { name: bestResume.name, roleTags: bestResume.roleTags, domains: bestResume.domains, seniority: bestResume.seniority }
          : { name: "Default Resume", roleTags: [], domains: [], seniority: "MID" },
        selectedBullets: selectedBullets.map((b) => ({ content: b.content, competencyTags: b.competencyTags })),
      });

      // Verifier
      const verifierReport = verifyGeneratedText(
        coverLetterText,
        { currentTitle: userProfile.currentTitle, skills: userProfile.skills, yearsExperience: userProfile.yearsExperience },
        selectedBullets,
        job.company
      );

      // ATS answers
      const customAnswers = answerCommonQuestions(
        { yearsExperience: userProfile.yearsExperience, workAuth: userProfile.workAuth, currentTitle: userProfile.currentTitle, skills: userProfile.skills },
        job.title
      );

      // Updated fit score
      const fitResult = scoreJob(job, userProfile, preferredSeniorities);

      // Save — status stays PREPARED for human review
      await db.application.update({
        where: { id: application.id },
        data: {
          coverLetter: coverLetterText,
          customAnswers: JSON.parse(JSON.stringify(customAnswers)),
          verifierReport: JSON.parse(JSON.stringify(verifierReport)),
          resumeId: bestResume?.id ?? application.resumeId,
          fitScore: fitResult.score,
          fitExplanation: fitResult.explanation,
        },
      });

      result.prepared++;
      result.log.push(`[READY] ${job.title} @ ${job.company} — queued for review${verifierReport.passed ? "" : " (verifier flagged issues)"}`);

    } catch (err) {
      result.errors++;
      result.log.push(`[ERROR] ${job.title} @ ${job.company} — ${String(err)}`);
    }
  }

  return result;
}
