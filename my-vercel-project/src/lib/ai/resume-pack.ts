import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ResumedBullet {
  original: string;
  rewritten: string;
  improvement: string; // one-line note on what changed and why
}

export interface ResumePack {
  headline: string;        // Tailored resume title/headline
  summary: string;         // 2–3 sentence professional summary for this role
  bullets: ResumedBullet[]; // 6–8 rewritten achievement bullets
  keywords: string[];      // ATS keywords to weave throughout
  notes: string;           // Any other tailoring advice (gaps, framing tips)
}

const RESUME_PACK_TOOL: Anthropic.Tool = {
  name: "generate_resume_pack",
  description: "Tailored resume content pack for a specific job application",
  input_schema: {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description:
          "A concise resume headline/title (1 line) that mirrors the job title and level while staying authentic to the candidate's background. E.g. 'Senior Product Manager — Growth & Monetization'",
      },
      summary: {
        type: "string",
        description:
          "A 2–3 sentence professional summary tailored to this specific role and company. Should lead with the most relevant experience, use JD language, and close with a forward-looking statement about what the candidate brings to this team.",
      },
      bullets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string", description: "The original bullet verbatim" },
            rewritten: {
              type: "string",
              description:
                "Rewritten bullet that mirrors JD language, leads with impact, and uses the STAR structure. Keep the facts — never invent metrics or outcomes.",
            },
            improvement: {
              type: "string",
              description:
                "One sentence: what changed and why (e.g. Added JD keyword cross-functional alignment, moved metric to lead position)",
            },
          },
          required: ["original", "rewritten", "improvement"],
        },
        description:
          "The 6–8 most relevant bullets from the candidate's list, each rewritten for this role. Pick the ones that address the JD's key requirements.",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "8–12 exact keywords and phrases from the JD that should appear in the resume for ATS matching. Include both hard skills and soft-skill phrases the JD emphasises.",
      },
      notes: {
        type: "string",
        description:
          "2–4 sentences of tailoring advice: what to emphasise, what to de-emphasise, any narrative framing tips, or red flags to pre-empt. Be specific and actionable.",
      },
    },
    required: ["headline", "summary", "bullets", "keywords", "notes"],
  },
};

export interface ResumePatchInput {
  job: {
    title: string;
    company: string;
    description: string;
    requirements: string[];
  };
  userProfile: {
    currentTitle: string | null;
    yearsExperience: number | null;
    linkedinAbout: string | null;
    skills: string[];
    industries: string[];
  };
  bullets: Array<{
    content: string;
    competencyTags: string[];
    proofStrength: number;
  }>;
}

export async function generateResumePack(input: ResumePatchInput): Promise<ResumePack> {
  const { job, userProfile, bullets } = input;

  const bulletList =
    bullets.length > 0
      ? bullets
          .sort((a, b) => b.proofStrength - a.proofStrength)
          .map((b, i) => `${i + 1}. ${b.content} [tags: ${b.competencyTags.join(", ")}]`)
          .join("\n")
      : "No bullets provided.";

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 3000,
    tools: [RESUME_PACK_TOOL],
    tool_choice: { type: "any" },
    system:
      "You are an elite resume writer and career strategist with deep expertise in ATS optimisation and hiring manager psychology. You craft resume content that is truthful, specific, and strategically aligned to the role — never generic, never invented. Every rewrite keeps the candidate's original facts intact while making them land harder.",
    messages: [
      {
        role: "user",
        content: `Generate a tailored resume pack for this candidate applying to the role below.

## Target Role
Title: ${job.title}
Company: ${job.company}
Requirements: ${job.requirements.join(", ") || "See description"}

Job description:
${job.description.slice(0, 3500)}

## Candidate
Current title: ${userProfile.currentTitle ?? "Not specified"}
Years of experience: ${userProfile.yearsExperience ?? "Not specified"}
Industries: ${userProfile.industries.join(", ") || "Not specified"}
Skills: ${userProfile.skills.join(", ") || "Not specified"}
LinkedIn bio: ${userProfile.linkedinAbout ?? "Not provided"}

## Achievement Bullets (all available — pick the 6–8 most relevant)
${bulletList}

Rules:
- Never invent metrics, companies, or outcomes
- Rewrite bullets using JD language while keeping facts intact
- Select only bullets that address real requirements in this JD
- Be specific and surgical — no generic career advice

Generate the resume pack now.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Resume pack generation did not return structured output");
  }

  return toolUse.input as ResumePack;
}
