import { Job, Seniority, UserProfile } from "@prisma/client";

export interface FitResult {
  score: number; // 0.0–1.0
  explanation: string;
  matchedSkills: string[];
  missedSkills: string[];
}

const SENIORITY_ORDER: Seniority[] = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "EXECUTIVE",
];

// ─── Keyword extraction ───────────────────────────────────────────────────────

/** Skills extracted from job descriptions — focused on PM/strategy domain. */
const SKILL_KEYWORDS = [
  // Data & Analytics
  "analytics", "data analysis", "business intelligence",
  "a/b testing", "experimentation", "statistics", "forecasting",
  // PM / Strategy
  "product management", "product strategy", "product roadmap", "roadmap",
  "stakeholder management", "cross-functional", "agile", "scrum", "okrs", "kpis",
  "go-to-market", "gtm", "market research", "competitive analysis",
  "user research", "customer discovery", "product discovery",
  "pricing strategy", "revenue growth", "business strategy",
  "program management", "project management", "pmp",
  "saas", "b2b", "b2c", "enterprise", "platform",
  "growth", "retention", "monetization", "conversion",
  "integrations", "technical product",
  // Design
  "design thinking", "prototyping", "wireframing",
  // Leadership
  "team leadership", "people management", "hiring", "mentoring",
  // Short/ambiguous — matched with word boundaries (see WORD_BOUNDARY_KEYWORDS)
  "ux", "ui", "api",
];

/** Short/ambiguous keywords that must match as whole words, not substrings. */
const WORD_BOUNDARY_KEYWORDS = new Set(["ux", "ui", "api"]);

export function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((kw) => {
    if (WORD_BOUNDARY_KEYWORDS.has(kw)) {
      return new RegExp(`\\b${kw}\\b`).test(lower);
    }
    return lower.includes(kw);
  });
}

// ─── Scoring dimensions ───────────────────────────────────────────────────────

/** How well the job title aligns with the user's target roles.
 *
 * A role matches only if the full role phrase is present in the title, or if
 * ALL significant words (>3 chars) from the role appear in the title. This
 * prevents "manager" alone matching any management title regardless of domain.
 */
function roleRelevanceScore(jobTitle: string, targetRoles: string[]): number {
  if (targetRoles.length === 0) return 0.5; // neutral — no preference set
  const titleLower = jobTitle.toLowerCase();
  for (const role of targetRoles) {
    const roleLower = role.toLowerCase();
    // Full phrase match (best case)
    if (titleLower.includes(roleLower)) return 1.0;
    // All significant words must match
    const words = roleLower.split(/\s+/).filter((w) => w.length > 3);
    if (words.length > 0 && words.every((w) => titleLower.includes(w))) return 0.9;
  }
  return 0.2; // title doesn't match any target role
}

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

  if (!detectedSeniority || userSeniorities.length === 0) return 0.5; // neutral

  if (userSeniorities.includes(detectedSeniority)) return 1.0;

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
  if (requirements.length === 0) return { score: 0.5, matched: [], missed: [] };
  if (userSkills.length === 0)
    return { score: 0.0, matched: [], missed: requirements };

  const userSkillsLower = userSkills.map((s) => s.toLowerCase());
  const matched: string[] = [];
  const missed: string[] = [];

  for (const req of requirements) {
    const reqLower = req.toLowerCase();
    // User skill must contain the requirement (e.g. "React Native" covers "react"),
    // but NOT the reverse — avoids short user skills matching unrelated requirements.
    if (userSkillsLower.some((s) => s.includes(reqLower))) {
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Score a job against a user profile.
 * Weights: 40% role relevance + 35% skills match + 25% seniority fit.
 */
export function scoreJob(
  job: Job,
  profile: UserProfile,
  preferredSeniorities: Seniority[],
  targetRoles: string[] = []
): FitResult {
  const role = roleRelevanceScore(job.title, targetRoles.length > 0 ? targetRoles : profile.targetRoles ?? []);
  const skills = skillsScore(job.requirements, profile.skills ?? []);
  const seniority = seniorityScore(job.title, preferredSeniorities);

  const score = 0.40 * role + 0.35 * skills.score + 0.25 * seniority;

  const parts: string[] = [];
  if (skills.matched.length > 0) {
    parts.push(`Matched: ${skills.matched.slice(0, 5).join(", ")}`);
  }
  if (skills.missed.length > 0) {
    parts.push(`Missing: ${skills.missed.slice(0, 3).join(", ")}`);
  }

  const explanation = parts.length > 0 ? parts.join(". ") : "General match based on role and seniority";

  return {
    score: Math.min(1, Math.max(0, score)),
    explanation,
    matchedSkills: skills.matched,
    missedSkills: skills.missed,
  };
}
