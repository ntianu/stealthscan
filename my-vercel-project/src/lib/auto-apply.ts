import { db } from "@/lib/db";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { answerCommonQuestions } from "@/lib/ai/answer-gen";
import { verifyGeneratedText } from "@/lib/ai/verifier";
import { selectBestResume, selectRelevantBullets } from "@/lib/ai/resume-select";
import { scoreJob } from "@/lib/matching/scorer";
import { buildApplyKit, submitToGreenhouse, submitToLever } from "@/lib/submission/kit-builder";

export interface AutoApplyResult {
  userId: string;
  processed: number;
  submitted: number;
  approved: number;   // kits ready for manual apply
  skipped: number;    // verifier failed
  errors: number;
  log: string[];
}

/**
 * Process all PREPARED applications for a user that meet the auto-apply threshold.
 * Called from the cron or a user-triggered endpoint.
 */
export async function runAutoApply(userId: string): Promise<AutoApplyResult> {
  const result: AutoApplyResult = {
    userId,
    processed: 0,
    submitted: 0,
    approved: 0,
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

  // Load user + profile + resumes + bullets once
  const [user, userProfile, resumes, bullets] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    db.userProfile.findUnique({ where: { userId } }),
    db.resume.findMany({ where: { userId } }),
    db.bullet.findMany({ where: { userId } }),
  ]);

  if (!user || !userProfile) {
    result.log.push("User or profile not found — skipping.");
    return result;
  }

  // Find PREPARED applications above the threshold
  const applications = await db.application.findMany({
    where: {
      userId,
      status: "PREPARED",
      fitScore: { gte: threshold },
    },
    include: { job: true, resume: true },
    orderBy: { fitScore: "desc" },
  });

  result.log.push(`Found ${applications.length} application(s) at or above ${Math.round(threshold * 100)}% threshold.`);

  for (const application of applications) {
    result.processed++;
    const job = application.job;

    try {
      // 1. Select resume + bullets
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

      // 2. Generate cover letter
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

      // 3. Verifier gate — skip if failed
      const verifierReport = verifyGeneratedText(
        coverLetterText,
        { currentTitle: userProfile.currentTitle, skills: userProfile.skills, yearsExperience: userProfile.yearsExperience },
        selectedBullets,
        job.company
      );

      if (!verifierReport.passed) {
        result.skipped++;
        result.log.push(`[SKIP] ${job.title} @ ${job.company} — verifier failed: ${verifierReport.issues?.join(", ")}`);
        // Still save the generated content so user can review manually
        await db.application.update({
          where: { id: application.id },
          data: {
            coverLetter: coverLetterText,
            verifierReport: JSON.parse(JSON.stringify(verifierReport)),
            resumeId: bestResume?.id ?? application.resumeId,
          },
        });
        continue;
      }

      // 4. ATS answers
      const customAnswers = answerCommonQuestions(
        { yearsExperience: userProfile.yearsExperience, workAuth: userProfile.workAuth, currentTitle: userProfile.currentTitle, skills: userProfile.skills },
        job.title
      );

      // 5. Update fit score
      const preferredSeniorities = await db.searchProfile
        .findMany({ where: { userId, active: true }, select: { seniority: true } })
        .then((ps: { seniority: string[] }[]) => ps.flatMap((p) => p.seniority) as import("@prisma/client").Seniority[]);
      const fitResult = scoreJob(job, userProfile, preferredSeniorities);

      // Save generated content
      const resumeToUse = bestResume ?? application.resume;
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

      // 6. Attempt submission
      const source = job.source;
      if ((source === "GREENHOUSE" || source === "LEVER") && resumeToUse) {
        const nameParts = (user.name ?? "").split(" ");
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.slice(1).join(" ") || "";

        let subResult: { success: boolean; confirmationId?: string; error?: string };

        if (source === "GREENHOUSE") {
          const slugMatch = job.applyUrl.match(/greenhouse\.io\/(.+?)\/jobs/);
          const companySlug = slugMatch?.[1] ?? job.company.toLowerCase();
          subResult = await submitToGreenhouse({
            jobId: job.externalId,
            companySlug,
            firstName,
            lastName,
            email: user.email,
            resumeUrl: resumeToUse.fileUrl,
            coverLetter: coverLetterText,
            answers: customAnswers,
          });
        } else {
          subResult = await submitToLever({
            postingId: job.externalId,
            companySlug: job.company.toLowerCase().replace(/\s+/g, ""),
            name: user.name ?? user.email,
            email: user.email,
            resumeUrl: resumeToUse.fileUrl,
            coverLetter: coverLetterText,
          });
        }

        if (subResult.success) {
          await db.$transaction([
            db.application.update({
              where: { id: application.id },
              data: { status: "SUBMITTED", submittedAt: new Date(), coverLetter: coverLetterText, customAnswers },
            }),
            db.applicationProof.create({
              data: {
                applicationId: application.id,
                jobSnapshot: job as never,
                resumeSnapshot: resumeToUse.fileUrl,
                coverLetterText,
                answersSnapshot: customAnswers as never,
                verifierReport: JSON.parse(JSON.stringify(verifierReport)),
              },
            }),
          ]);
          result.submitted++;
          result.log.push(`[SUBMITTED] ${job.title} @ ${job.company}`);
          continue;
        } else {
          result.log.push(`[WARN] ${job.title} @ ${job.company} — API submission failed (${subResult.error}), falling back to kit.`);
        }
      }

      // For other sources or API failures: mark APPROVED with kit ready
      await db.application.update({
        where: { id: application.id },
        data: { status: "APPROVED", coverLetter: coverLetterText, customAnswers },
      });
      result.approved++;
      result.log.push(`[APPROVED] ${job.title} @ ${job.company} — Apply Kit ready for manual submission.`);

    } catch (err) {
      result.errors++;
      result.log.push(`[ERROR] ${job.title} @ ${job.company} — ${String(err)}`);
    }
  }

  return result;
}
