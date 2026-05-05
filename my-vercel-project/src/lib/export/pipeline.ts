/**
 * End-to-end pipeline glue used by the API routes.
 *
 *   buildMergedResume({ userId, applicationId, pack? })
 *     → resolves the master Resume for this application
 *     → fetches the master file from UploadThing
 *     → parses it (PDF only in Phase A; DOCX in Phase B)
 *     → optionally regenerates ResumePack via Anthropic if `pack` not supplied
 *     → merges → returns MergedResume + diagnostics
 */

import { db } from "@/lib/db";
import { generateResumePack } from "@/lib/ai/resume-pack";
import { assembleContext, resumePackSlices } from "@/lib/context/assemble";
import { parsePdfMaster } from "./parse-pdf";
import { mergePackIntoStructure } from "./merge";
import type { MergeResult, ResumePackInput } from "./types";

export interface BuildMergedInput {
  userId: string;
  applicationId: string;
  /**
   * Pre-generated ResumePack to apply. When omitted, we regenerate via the AI.
   * Re-using a cached pack avoids a duplicate AI call when the user clicks
   * both "Download DOCX" and "Download PDF" in the same session.
   */
  pack?: ResumePackInput;
}

export interface BuildMergedResult extends MergeResult {
  /** The resume Filename suitable for use as the download filename stem. */
  filenameStem: string;
  /** Whether the master Resume was a PDF (Phase A) or DOCX (Phase B). */
  masterFormat: "pdf" | "docx";
}

class ExportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export { ExportError };

export async function buildMergedResume({
  userId,
  applicationId,
  pack,
}: BuildMergedInput): Promise<BuildMergedResult> {
  // ── Load application + job + the chosen master Resume ───────────────────
  const application = await db.application.findUnique({
    where: { id: applicationId, userId },
    include: { job: true, resume: true },
  });
  if (!application) throw new ExportError("Application not found", 404);

  // Resolve master: explicit application.resume → user's default → most recent active.
  let master = application.resume;
  if (!master) {
    master = await db.resume.findFirst({
      where: { userId, active: true, isDefault: true },
    });
  }
  if (!master) {
    master = await db.resume.findFirst({
      where: { userId, active: true },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!master) {
    throw new ExportError(
      "No master resume found. Upload a resume in the Resumes section first.",
      400
    );
  }

  // ── Fetch master bytes ──────────────────────────────────────────────────
  const masterRes = await fetch(master.fileUrl);
  if (!masterRes.ok) {
    throw new ExportError(
      `Failed to fetch master resume (${masterRes.status} ${masterRes.statusText}).`,
      502
    );
  }
  const masterBuffer = Buffer.from(await masterRes.arrayBuffer());

  // ── Detect format. Phase A only handles PDF; DOCX is Phase B. ───────────
  const isPdf =
    masterBuffer.subarray(0, 4).toString("ascii") === "%PDF" ||
    /\.pdf(\?|$)/i.test(master.fileUrl);
  const isDocx =
    !isPdf &&
    (masterBuffer.subarray(0, 2).toString("ascii") === "PK" ||
      /\.docx(\?|$)/i.test(master.fileUrl));

  if (!isPdf && !isDocx) {
    throw new ExportError(
      "Master resume must be a PDF or DOCX file.",
      400
    );
  }
  if (isDocx) {
    throw new ExportError(
      "DOCX master parsing is not yet implemented (Phase B). Please upload a PDF master for now.",
      501
    );
  }

  const structure = await parsePdfMaster(masterBuffer);

  // ── Resolve the ResumePack (use supplied or regenerate) ─────────────────
  let resolvedPack: ResumePackInput;
  if (pack) {
    resolvedPack = pack;
  } else {
    const [userProfile, bullets, careerContext] = await Promise.all([
      db.userProfile.findUnique({ where: { userId } }),
      db.bullet.findMany({ where: { userId } }),
      assembleContext(userId, resumePackSlices()),
    ]);
    if (!userProfile) {
      throw new ExportError(
        "Complete your Professional Profile in Settings before generating exports.",
        400
      );
    }
    if (bullets.length === 0) {
      throw new ExportError(
        "Add at least one Skill Bullet before generating exports.",
        400
      );
    }

    const job = application.job;
    resolvedPack = await generateResumePack({
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
      },
      userProfile: {
        currentTitle: userProfile.currentTitle,
        yearsExperience: userProfile.yearsExperience,
        linkedinAbout: userProfile.linkedinAbout,
        skills: userProfile.skills,
        industries: userProfile.industries,
      },
      bullets: bullets.map((b) => ({
        id: b.id,
        content: b.content,
        competencyTags: b.competencyTags,
        proofStrength: b.proofStrength,
      })),
      careerContext: careerContext || undefined,
    });
  }

  const merged = mergePackIntoStructure(structure, resolvedPack);

  // Build a sensible download stem: "Lastname-Company-Role"
  const namePart = (structure.contact.name?.split(/\s+/).pop() ?? "Resume").replace(/[^\w]/g, "");
  const companyPart = application.job.company.replace(/[^\w]/g, "").slice(0, 40);
  const rolePart = application.job.title
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const filenameStem = [namePart, companyPart, rolePart].filter(Boolean).join("-");

  return {
    ...merged,
    filenameStem,
    masterFormat: "pdf",
  };
}
