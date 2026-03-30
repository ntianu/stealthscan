import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface HiddenSignal {
  signal: string;       // The phrase from the JD
  translation: string;  // What they actually mean
  dealbreaker: boolean;
}

export interface RankedBullet {
  bulletId: string;
  content: string;
  relevanceScore: number;         // 0.0–1.0
  suggestedRewrite: string | null; // Rewritten to mirror JD language, null if already strong
  whyItMatters: string;           // Which JD requirement this addresses
}

export interface JobIntel {
  roleSynthesis: string;      // What this role really is (not just the title)
  hiddenScorecard: HiddenSignal[];
  rankedBullets: RankedBullet[];
  coverLetterAngle: string;   // Strategic opening hook for the letter
  keywords: string[];         // Exact phrases from JD to mirror
}

export interface JobIntelInput {
  job: {
    title: string;
    company: string;
    description: string;
    requirements: string[];
  };
  userProfile: {
    currentTitle: string | null;
    yearsExperience: number | null;
    skills: string[];
    industries: string[];
  };
  bullets: Array<{
    id: string;
    content: string;
    competencyTags: string[];
    roleTags: string[];
    proofStrength: number;
  }>;
}

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "analyze_job",
  description: "Structured intelligence report on a job opportunity for a specific candidate",
  input_schema: {
    type: "object",
    properties: {
      roleSynthesis: {
        type: "string",
        description: "2-3 sentences on what this role ACTUALLY is beyond the title — what problem it solves, what makes it unique, what the hiring manager really needs right now.",
      },
      hiddenScorecard: {
        type: "array",
        items: {
          type: "object",
          properties: {
            signal: { type: "string", description: "A phrase or requirement from the JD" },
            translation: { type: "string", description: "What they actually mean / what failure mode they're screening against" },
            dealbreaker: { type: "boolean", description: "True if this is likely a hard filter" },
          },
          required: ["signal", "translation", "dealbreaker"],
        },
        description: "4–6 decoded signals from the JD language that reveal the real hiring criteria",
      },
      rankedBullets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            bulletId: { type: "string" },
            content: { type: "string" },
            relevanceScore: { type: "number", description: "0.0–1.0 relevance to this specific role" },
            suggestedRewrite: { type: "string", description: "Rewrite that mirrors JD language and adds missing context. Omit (null) if the bullet is already strong as-is." },
            whyItMatters: { type: "string", description: "The specific JD requirement this bullet addresses" },
          },
          required: ["bulletId", "content", "relevanceScore", "whyItMatters"],
        },
        description: "Candidate's top 5 bullets ranked by relevance, with suggested rewrites where helpful",
      },
      coverLetterAngle: {
        type: "string",
        description: "1–2 sentence strategic hook that the cover letter should open with — specific to this role and company, not generic.",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "5–8 exact phrases from the JD the candidate should mirror verbatim in their materials",
      },
    },
    required: ["roleSynthesis", "hiddenScorecard", "rankedBullets", "coverLetterAngle", "keywords"],
  },
};

export async function analyzeJob(input: JobIntelInput): Promise<JobIntel> {
  const { job, userProfile, bullets } = input;

  const bulletList = bullets.length > 0
    ? bullets.map((b) => `[${b.id}] ${b.content} (tags: ${b.competencyTags.join(", ")})`).join("\n")
    : "No bullets provided.";

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "any" },
    system: "You are a senior recruiter and career strategist who reads job descriptions with deep pattern recognition. Your job is to decode what a company is really asking for — not just what they wrote — and map that against a candidate's specific experience.",
    messages: [
      {
        role: "user",
        content: `Analyze this job for my candidate and produce a structured intelligence report.

## Job
Title: ${job.title}
Company: ${job.company}
Requirements: ${job.requirements.join(", ") || "See description"}

Full description:
${job.description.slice(0, 3000)}

## Candidate Profile
Current title: ${userProfile.currentTitle ?? "Not specified"}
Years experience: ${userProfile.yearsExperience ?? "Not specified"}
Skills: ${userProfile.skills.join(", ") || "Not specified"}
Industries: ${userProfile.industries.join(", ") || "Not specified"}

## Candidate's Achievement Bullets
${bulletList}

Produce the analysis now.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Job analysis did not return structured output");
  }

  return toolUse.input as JobIntel;
}
