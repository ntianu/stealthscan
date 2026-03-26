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

/** Skills/tools extracted from job descriptions. Covers engineering AND PM/strategy. */
const SKILL_KEYWORDS = [
  // Engineering
  "python", "javascript", "typescript", "react", "node.js", "sql", "postgresql",
  "mongodb", "docker", "kubernetes", "aws", "gcp", "azure", "java", "go", "rust",
  "machine learning", "data science", "figma", "swift", "kotlin", "ruby", "php",
  "graphql", "redis", "terraform", "ci/cd", "llm", "ai", "ml",
  "tableau", "looker", "dbt", "snowflake", "spark", "hadoop",
  // Data & Analytics
  "analytics", "data analysis", "data engineering", "business intelligence",
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
  "api", "integrations", "technical product",
  // Design
  "ux", "ui", "design thinking", "prototyping", "wireframing",
  // Leadership
  "team leadership", "people management", "hiring", "mentoring",
];

export function extractRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((kw) => lower.includes(kw));
}

// ─── Scoring dimensions ───────────────────────────────────────────────────────

/** How well the job title aligns with the user's target roles. */
function roleRelevanceScore(jobTitle: string, targetRoles: string[]): number {
  if (targetRoles.length === 0) return 0.7; // neutral — no preference set
  const titleLower = jobTitle.toLowerCase();
  for (const role of targetRoles) {
    const words = role.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => titleLower.includes(w))) return 1.0;
  }
  return 0.3; // title doesn't match any target role
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

  if (!detectedSeniority || userSeniorities.length === 0) return 0.7; // neutral

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
