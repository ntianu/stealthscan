/**
 * Career Context Assembly
 *
 * Fetches and compiles a user's context documents into a prompt-injectable
 * string. Each AI call declares which context slices it needs.
 *
 * Context is injected as a <career_context> block so models can distinguish
 * it from user-provided data (job description, resume, etc.).
 */

import { db } from "@/lib/db";
import type { ContextDocumentType } from "@prisma/client";

export type ContextSlice =
  | "career_strategy"
  | "positioning"
  | "experience_library"
  | "decision_rules"
  | "writing_voice"
  | "target_companies"
  | "decision_log";

const SECTION_LABELS: Record<ContextSlice, string> = {
  career_strategy: "Career Strategy",
  positioning: "Positioning & Value Proposition",
  experience_library: "Experience Library",
  decision_rules: "Decision Rules & Criteria",
  writing_voice: "Writing Voice & Style",
  target_companies: "Target Companies",
  decision_log: "Decision Log",
};

/**
 * Fetch and assemble context documents for a user.
 *
 * @param userId - internal user ID (not Clerk ID)
 * @param slices - which document types to include
 * @returns compiled context string, or empty string if all docs are empty
 */
export async function assembleContext(
  userId: string,
  slices: ContextSlice[]
): Promise<string> {
  if (slices.length === 0) return "";

  const docs = await db.contextDocument.findMany({
    where: {
      userId,
      type: { in: slices as ContextDocumentType[] },
    },
    select: { type: true, compiled: true, content: true },
  });

  if (docs.length === 0) return "";

  const sections: string[] = [];

  for (const slice of slices) {
    const doc = docs.find((d) => d.type === slice);
    if (!doc) continue;

    const text = (doc.compiled ?? doc.content ?? "").trim();
    if (!text) continue;

    sections.push(`### ${SECTION_LABELS[slice]}\n${text}`);
  }

  if (sections.length === 0) return "";

  return `<career_context>\n${sections.join("\n\n")}\n</career_context>`;
}

/**
 * Convenience: assemble the context slices relevant for cover letter generation.
 */
export function coverLetterSlices(): ContextSlice[] {
  return ["writing_voice", "experience_library", "positioning"];
}

/**
 * Convenience: assemble the context slices relevant for job intelligence analysis.
 */
export function jobIntelSlices(): ContextSlice[] {
  return ["career_strategy", "positioning", "decision_rules", "target_companies"];
}

/**
 * Convenience: assemble the context slices relevant for resume pack generation.
 */
export function resumePackSlices(): ContextSlice[] {
  return ["experience_library", "positioning", "writing_voice"];
}
