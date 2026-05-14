/**
 * Glue to assemble a CoverLetterInput from an Application.
 *
 * Unlike the resume pipeline, the cover letter doesn't need a master file —
 * the body is just persisted text on Application.coverLetter (set by the
 * AI-generation flow and updated in-place by client edits when persistence
 * is wired). We pull contact info from the user's UserProfile.
 */

import { db } from "@/lib/db";
import { ExportError } from "./pipeline";
import type { CoverLetterInput } from "./cover-letter-types";

export interface BuildCoverLetterInput {
  userId: string;
  applicationId: string;
  /** Optional override — when present, used instead of Application.coverLetter. */
  body?: string;
}

export interface BuildCoverLetterResult {
  letter: CoverLetterInput;
  filenameStem: string;
}

export async function buildCoverLetterInput({
  userId,
  applicationId,
  body,
}: BuildCoverLetterInput): Promise<BuildCoverLetterResult> {
  const application = await db.application.findUnique({
    where: { id: applicationId, userId },
    include: { job: true },
  });
  if (!application) throw new ExportError("Application not found", 404);

  const text = (body ?? application.coverLetter ?? "").trim();
  if (!text) {
    throw new ExportError(
      "No cover letter to export. Generate one first.",
      400
    );
  }

  const userProfile = await db.userProfile.findUnique({ where: { userId } });
  const user = await db.user.findUnique({ where: { id: userId } });

  const sender: CoverLetterInput["sender"] = {
    name: user?.name ?? undefined,
    email: user?.email ?? undefined,
    linkedin: userProfile?.linkedinUrl ?? undefined,
    // UserProfile doesn't currently store phone/location; leave undefined.
  };

  const recipient: CoverLetterInput["recipient"] = {
    company: application.job.company,
    location: application.job.location ?? undefined,
  };

  // Filename stem mirrors the resume export naming
  const namePart = (sender.name?.split(/\s+/).pop() ?? "Cover-Letter").replace(/[^\w]/g, "");
  const companyPart = application.job.company.replace(/[^\w]/g, "").slice(0, 40);
  const rolePart = application.job.title
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const filenameStem = [namePart, companyPart, rolePart, "Cover-Letter"]
    .filter(Boolean)
    .join("-");

  return {
    letter: { sender, recipient, body: text },
    filenameStem,
  };
}
