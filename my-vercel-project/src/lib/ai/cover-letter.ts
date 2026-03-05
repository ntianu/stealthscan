import Anthropic from "@anthropic-ai/sdk";
import { Job, UserProfile, Bullet, Resume } from "@prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface CoverLetterInput {
  job: Pick<Job, "title" | "company" | "description" | "requirements">;
  userProfile: Pick<
    UserProfile,
    "currentTitle" | "yearsExperience" | "skills" | "industries"
  >;
  resume: Pick<Resume, "name" | "roleTags" | "domains" | "seniority">;
  selectedBullets: Pick<Bullet, "content" | "competencyTags">[];
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
  const { job, userProfile, selectedBullets } = input;

  const bulletList = selectedBullets
    .map((b) => `• ${b.content}`)
    .join("\n");

  const systemPrompt = `You are a professional cover letter writer. Your ONLY job is to write a cover letter body using EXCLUSIVELY the facts provided below.

HARD RULES (violations will be caught by an automated verifier):
1. Do NOT invent any employer names, job titles, dates, metrics, or credentials not provided.
2. Do NOT claim any skill not listed in the user's skills list.
3. Do NOT use the word "passionate" or any hollow filler phrase.
4. Output ONLY the letter body—no "Dear Hiring Manager," header, no signature block.
5. Maximum 3 paragraphs. Be specific and concise.
6. Use first person ("I").`;

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
${bulletList || "No bullets provided—use only the profile facts above."}

Write the cover letter body now:`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

  return { text, tokensUsed };
}
