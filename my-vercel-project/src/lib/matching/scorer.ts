import { Job, Seniority, UserProfile } from "@prisma/client";

export interface FitResult {
  score: number; // 0.0–1.0
  explanation: string;
}

const SENIORITY_ORDER: Seniority[] = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "EXECUTIVE",
];

function seniorityScore(
  jobTitle: string,
  userSeniorities: Seniority[]
): number {
  const titleLower = jobTitle.toLowerCase();
  const seniorityMap: Record<string, Seniority> = {
    intern: "INTERN",
    junior: "JUNIOR",
    associate: "JUNIOR",
    mid: "MID",
    "mid-level": "MID",
    senior: "SENIOR",
    sr: "SENIOR",
    lead: "LEAD",
    principal: "LEAD",
    staff: "LEAD",
    director: "EXECUTIVE",
    vp: "EXECUTIVE",
    head: "EXECUTIVE",
  };

  let detectedSeniority: Seniority | null = null;
  for (const [kw, seniority] of Object.entries(seniorityMap)) {
    if (titleLower.includes(kw)) {
      detectedSeniority = seniority;
      break;
    }
  }

  if (!detectedSeniority || userSeniorities.length === 0) return 0.7; // neutral

  if (userSeniorities.includes(detectedSeniority)) return 1.0;

  // Penalize by distance
  const detectedIdx = SENIORITY_ORDER.indexOf(detectedSeniority);
  const minDistance = Math.min(
    ...userSeniorities.map((s) =>
      Math.abs(SENIORITY_ORDER.indexOf(s) - detectedIdx)
    )
  );

  if (minDistance === 1) return 0.6;
  if (minDistance === 2) return 0.3;
  return 0.0;
}

function skillsScore(
  requirements: string[],
  userSkills: string[]
): { score: number; matched: string[]; missed: string[] } {
  if (requirements.length === 0) return { score: 0.7, matched: [], missed: [] };
  if (userSkills.length === 0)
    return { score: 0.0, matched: [], missed: requirements };

  const userSkillsLower = userSkills.map((s) => s.toLowerCase());
  const matched: string[] = [];
  const missed: string[] = [];

  for (const req of requirements) {
    const reqLower = req.toLowerCase();
    if (userSkillsLower.some((s) => s.includes(reqLower) || reqLower.includes(s))) {
      matched.push(req);
    } else {
      missed.push(req);
    }
  }

  return {
    score: matched.length / requirements.length,
    matched,
    missed,
  };
}

/**
 * Score a job against a user profile. Returns score (0–1) and explanation text.
 */
export function scoreJob(
  job: Job,
  profile: UserProfile,
  preferredSeniorities: Seniority[]
): FitResult {
  const skills = skillsScore(job.requirements, profile.skills ?? []);
  const seniority = seniorityScore(job.title, preferredSeniorities);

  const score = 0.6 * skills.score + 0.4 * seniority;

  const parts: string[] = [];
  if (skills.matched.length > 0) {
    parts.push(`Matched skills: ${skills.matched.slice(0, 5).join(", ")}`);
  }
  if (skills.missed.length > 0) {
    parts.push(`Missing: ${skills.missed.slice(0, 3).join(", ")}`);
  }

  const explanation = parts.length > 0 ? parts.join(". ") : "General match";

  return { score: Math.min(1, Math.max(0, score)), explanation };
}
