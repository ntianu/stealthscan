import { UserProfile, Bullet } from "@prisma/client";

export interface VerifierReport {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Automated verifier: checks that generated text doesn't hallucinate facts
 * beyond what's in the user's profile and bullet library.
 */
export function verifyGeneratedText(
  text: string,
  profile: Pick<UserProfile, "currentTitle" | "skills" | "yearsExperience">,
  selectedBullets: Pick<Bullet, "content">[],
  jobCompany: string
): VerifierReport {
  const issues: string[] = [];
  const warnings: string[] = [];
  const lowerText = text.toLowerCase();

  // Check for wrong company name being used as "my employer"
  // The generated text should reference the company being applied TO, not claim it as current employer
  const suspiciousPatterns = [
    `worked at ${jobCompany.toLowerCase()}`,
    `employed by ${jobCompany.toLowerCase()}`,
    `my role at ${jobCompany.toLowerCase()}`,
  ];
  for (const pattern of suspiciousPatterns) {
    if (lowerText.includes(pattern)) {
      issues.push(
        `Generated text falsely claims current employment at ${jobCompany}`
      );
    }
  }

  // Check for hollow filler phrases
  const fillerPhrases = ["passionate about", "results-driven", "team player", "go-getter"];
  for (const phrase of fillerPhrases) {
    if (lowerText.includes(phrase)) {
      warnings.push(`Weak filler phrase detected: "${phrase}"`);
    }
  }

  // Check for suspiciously specific numbers not in bullet library
  const bulletText = selectedBullets.map((b) => b.content.toLowerCase()).join(" ");
  const numberPattern = /(\d+)%|\$(\d+[km]?)/gi;
  let match;
  while ((match = numberPattern.exec(text)) !== null) {
    const num = match[0];
    if (!bulletText.includes(num.toLowerCase())) {
      warnings.push(`Specific metric "${num}" not found in bullet library—verify accuracy`);
    }
  }

  // Check minimum content quality
  if (text.length < 100) {
    issues.push("Cover letter is too short (under 100 characters)");
  }
  if (text.length > 2000) {
    warnings.push("Cover letter is long—consider trimming for readability");
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}
