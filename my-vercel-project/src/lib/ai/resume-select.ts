import { Job, Resume, Bullet } from "@prisma/client";

/**
 * Select the best resume from the library for a given job.
 * Uses tag overlap scoring: roleTags and domains.
 */
export function selectBestResume(
  resumes: Resume[],
  job: Pick<Job, "title" | "requirements" | "description">
): Resume | null {
  if (resumes.length === 0) return null;

  const activeResumes = resumes.filter((r) => r.active);
  if (activeResumes.length === 0) return resumes.find((r) => r.isDefault) ?? resumes[0];

  const jobText = `${job.title} ${job.description}`.toLowerCase();

  let bestResume = activeResumes[0];
  let bestScore = -1;

  for (const resume of activeResumes) {
    let score = 0;

    // Role tag overlap
    for (const tag of resume.roleTags) {
      if (jobText.includes(tag.toLowerCase())) score += 2;
    }

    // Domain tag overlap
    for (const domain of resume.domains) {
      if (jobText.includes(domain.toLowerCase())) score += 1;
    }

    // Boost default resume slightly
    if (resume.isDefault) score += 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestResume = resume;
    }
  }

  return bestResume;
}

/**
 * Select the most relevant bullets from the library for a given job.
 * Returns up to maxBullets sorted by relevance score.
 */
export function selectRelevantBullets(
  bullets: Bullet[],
  job: Pick<Job, "title" | "requirements" | "description">,
  maxBullets = 5
): Bullet[] {
  if (bullets.length === 0) return [];

  const jobText = `${job.title} ${job.requirements.join(" ")} ${job.description}`.toLowerCase();

  const scored = bullets.map((bullet) => {
    let score = 0;

    // Competency tag overlap with job text
    for (const tag of bullet.competencyTags) {
      if (jobText.includes(tag.toLowerCase())) score += 3;
    }

    // Role tag overlap
    for (const tag of bullet.roleTags) {
      if (jobText.includes(tag.toLowerCase())) score += 2;
    }

    // Industry tag overlap
    for (const tag of bullet.industryTags) {
      if (jobText.includes(tag.toLowerCase())) score += 1;
    }

    // Boost high proof-strength bullets
    score += bullet.proofStrength * 0.5;

    return { bullet, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxBullets)
    .map((s) => s.bullet);
}
