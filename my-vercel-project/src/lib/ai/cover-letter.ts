import Anthropic from "@anthropic-ai/sdk";
import { Job, UserProfile, Bullet, Resume } from "@prisma/client";
import type { JobIntel } from "@/lib/ai/job-intel";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface CoverLetterInput {
  job: Pick<Job, "title" | "company" | "description" | "requirements">;
  userProfile: Pick<
    UserProfile,
    "currentTitle" | "yearsExperience" | "skills" | "industries"
  >;
  resume: Pick<Resume, "name" | "roleTags" | "domains" | "seniority">;
  selectedBullets: Pick<Bullet, "content" | "competencyTags">[];
  jobIntel?: JobIntel;
}

export interface CoverLetterResult {
  text: string;
  tokensUsed: number;
}

/**
 * Generate a cover letter using Claude.
 * Strictly constrained: only uses facts from the provided profile + bullets.
 */
export async function generateCoverLetter(
  input: CoverLetterInput
): Promise<CoverLetterResult> {
  const { job, userProfile, selectedBullets, jobIntel } = input;

  const bulletList = selectedBullets
    .map((b) => `• ${b.content}`)
    .join("\n");

  // If we have intel, use rewritten bullets where available
  const intelBulletList = jobIntel?.rankedBullets
    ? jobIntel.rankedBullets
        .slice(0, 5)
        .map((b) => `• ${b.suggestedRewrite ?? b.content}`)
        .join("\n")
    : null;

  const systemPrompt = `You are a professional cover letter writer. Your ONLY job is to write a cover letter body using EXCLUSIVELY the facts provided below.

HARD RULES (violations will be caught by an automated verifier):
1. Do NOT invent any employer names, job titles, dates, metrics, or credentials not provided.
2. Do NOT claim any skill not listed in the user's skills list.
3. Do NOT use the word "passionate" or any hollow filler phrase.
4. Output ONLY the letter body—no "Dear Hiring Manager," header, no signature block.
5. Maximum 3 paragraphs. Be specific and concise.
6. Use first person ("I").`;

  const intelSection = jobIntel
    ? `
## Strategic intel for this role (use this to shape the letter)
Opening angle: ${jobIntel.coverLetterAngle}
What the role really needs: ${jobIntel.roleSynthesis}
Keywords to mirror verbatim: ${jobIntel.keywords.join(", ")}
`
    : "";

  const userMessage = `## Job to apply for
Title: ${job.title}
Company: ${job.company}
Key requirements: ${job.requirements.join(", ") || "See description"}
Description excerpt: ${job.description.slice(0, 800)}

## My professional facts (use ONLY these)
Current title: ${userProfile.currentTitle ?? "Not specified"}
Years of experience: ${userProfile.yearsExperience ?? "Not specified"}
Skills: ${userProfile.skills?.join(", ") || "Not specified"}
Industries: ${userProfile.industries?.join(", ") || "Not specified"}

## My achievement bullets (use 2–3 of these)
${intelBulletList ?? bulletList || "No bullets provided—use only the profile facts above."}
${intelSection}
Write the cover letter body now:`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 800,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const text =
    message.content.find((b) => b.type === "text")?.text ?? "";
  const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

  return { text, tokensUsed };
}
