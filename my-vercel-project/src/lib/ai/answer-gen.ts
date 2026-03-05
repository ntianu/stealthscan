import Anthropic from "@anthropic-ai/sdk";
import { UserProfile } from "@prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AtsQuestion {
  question: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
}

export type AtsAnswers = Record<string, string>;

/**
 * Common ATS questions answered from the user profile.
 * Handles most of the ~80% of repetitive questions without calling Claude.
 */
export function answerCommonQuestions(
  profile: Pick<
    UserProfile,
    "yearsExperience" | "workAuth" | "currentTitle" | "skills"
  >,
  jobTitle?: string
): AtsAnswers {
  const answers: AtsAnswers = {};

  // Work authorization
  const workAuthMap: Record<string, string> = {
    citizen: "Yes, I am authorized to work in the US",
    greencard: "Yes, I am authorized to work in the US (Green Card)",
    h1b: "I require visa sponsorship (H-1B)",
    opt: "I have OPT authorization",
    other: "Please contact me for work authorization details",
  };
  answers["work_authorization"] =
    workAuthMap[profile.workAuth] ?? "Yes, I am authorized to work";
  answers["require_sponsorship"] =
    profile.workAuth === "h1b" || profile.workAuth === "opt" ? "Yes" : "No";

  // Years of experience
  if (profile.yearsExperience !== null) {
    answers["years_of_experience"] = String(profile.yearsExperience);
    answers["total_experience"] = String(profile.yearsExperience);
  }

  // Remote/in-person preference
  answers["remote_preference"] = "Open to remote or hybrid";

  return answers;
}

/**
 * Use Claude to answer non-standard ATS questions based on the user profile.
 */
export async function generateCustomAnswers(
  questions: AtsQuestion[],
  profile: Pick<UserProfile, "currentTitle" | "yearsExperience" | "skills" | "industries">,
  jobTitle: string,
  companyName: string
): Promise<AtsAnswers> {
  if (questions.length === 0) return {};

  const qList = questions
    .map((q, i) => `Q${i + 1}: ${q.question}${q.options ? `\nOptions: ${q.options.join(", ")}` : ""}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `Answer ATS application questions truthfully using ONLY the provided user profile. Return a JSON object mapping question text to answer string. Never invent facts.`,
    messages: [
      {
        role: "user",
        content: `Applying for: ${jobTitle} at ${companyName}

User profile:
- Title: ${profile.currentTitle ?? "Professional"}
- Years of experience: ${profile.yearsExperience ?? "several years"}
- Skills: ${profile.skills?.join(", ") || "various"}

Questions to answer:
${qList}

Respond with JSON only: { "Q1": "answer", "Q2": "answer", ... }`,
      },
    ],
  });

  try {
    const text =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}
