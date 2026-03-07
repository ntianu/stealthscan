import { db } from "@/lib/db";
import { passesHardFilters } from "@/lib/matching/hard-filter";
import { scoreJob } from "@/lib/matching/scorer";
import { selectBestResume, selectRelevantBullets } from "@/lib/ai/resume-select";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { answerCommonQuestions } from "@/lib/ai/answer-gen";
import { verifyGeneratedText } from "@/lib/ai/verifier";

export interface PrepareResult {
  message: string;
  prepared: number;
}

/**
 * Core prepare logic — scores recent jobs and generates AI application packets
 * for each user with an active profile + resumes.
 * Extracted so it can be called both from the cron route handler AND
 * from /api/scan directly (avoids the Vercel Deployment Protection HTTP wall).
 */
export async function runPrepare(): Promise<PrepareResult> {
  const users = await db.user.findMany({
    include: {
      userProfile: true,
      searchProfiles: { where: { active: true } },
      resumes: { where: { active: true } },
      bullets: true,
    },
  });

  let totalPrepared = 0;

  for (const user of users) {
    if (!user.userProfile || user.searchProfiles.length === 0) continue;
    if (user.resumes.length === 0) continue;

    for (const profile of user.searchProfiles) {
      const existingJobIds = (
        await db.application.findMany({
          where: { userId: user.id },
          select: { jobId: true },
        })
      ).map((a) => a.jobId);

      const recentJobs = await db.job.findMany({
        where: {
          status: "ACTIVE",
          id: { notIn: existingJobIds },
        },
        orderBy: { fetchedAt: "desc" },
        take: 200,
      });

      const passing = recentJobs
        .filter((job) => passesHardFilters(job, profile))
        .map((job) => ({
          job,
          ...scoreJob(job, user.userProfile!, profile.seniority),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, profile.dailyLimit);

      for (const { job, score, explanation } of passing) {
        try {
          const selectedResume = selectBestResume(user.resumes, job);
          const selectedBullets = selectRelevantBullets(user.bullets, job);

          let coverLetter: string | null = null;
          let verifierReport: {
            passed: boolean;
            issues: string[];
            warnings: string[];
          } = { passed: true, issues: [], warnings: [] };

          if (selectedResume) {
            const result = await generateCoverLetter({
              job: {
                title: job.title,
                company: job.company,
                description: job.description,
                requirements: job.requirements,
              },
              userProfile: {
                currentTitle: user.userProfile.currentTitle,
                yearsExperience: user.userProfile.yearsExperience,
                skills: user.userProfile.skills,
                industries: user.userProfile.industries,
              },
              resume: {
                name: selectedResume.name,
                roleTags: selectedResume.roleTags,
                domains: selectedResume.domains,
                seniority: selectedResume.seniority,
              },
              selectedBullets,
            });

            coverLetter = result.text;
            verifierReport = verifyGeneratedText(
              result.text,
              user.userProfile,
              selectedBullets,
              job.company
            );
          }

          const commonAnswers = answerCommonQuestions(user.userProfile, job.title);

          await db.application.create({
            data: {
              userId: user.id,
              jobId: job.id,
              resumeId: selectedResume?.id ?? null,
              status: "PREPARED",
              fitScore: score,
              fitExplanation: explanation,
              coverLetter,
              customAnswers: commonAnswers,
              verifierReport,
            },
          });

          totalPrepared++;
        } catch (err) {
          console.error(`Failed to prepare application for job ${job.id}:`, err);
        }
      }
    }
  }

  return { message: "Preparation complete", prepared: totalPrepared };
}
