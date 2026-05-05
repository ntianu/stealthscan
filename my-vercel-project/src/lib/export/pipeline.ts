/**
 * End-to-end pipeline glue used by the API routes.
 *
 *   buildExportArtifact({ userId, applicationId, pack? })
 *     → resolves the master Resume for this application
 *     → fetches the master file from UploadThing
 *     → detects format (PDF or DOCX)
 *     → produces an `ExportArtifact` discriminated union that the renderer
 *       layer dispatches on:
 *         { kind: "rebuild", merged }   — render fresh from a parsed structure
 *         { kind: "edit",    buffer, pack } — surgical edit of the original DOCX
 *
 * The DOCX export route uses both kinds. The PDF export route only uses
 * "rebuild" — for DOCX masters we still parse to ResumeStructure and render
 * a fresh PDF rather than trying to convert a DOCX to PDF.
 */

import { db } from "@/lib/db";
import { generateResumePack } from "@/lib/ai/resume-pack";
import { assembleContext, resumePackSlices } from "@/lib/context/assemble";
import { parsePdfMaster } from "./parse-pdf";
import { parseDocxMaster } from "./parse-docx";
import { mergePackIntoStructure } from "./merge";
import type { MergeResult, ResumePackInput } from "./types";

export interface BuildExportInput {
  userId: string;
  applicationId: string;
  /** Pre-generated ResumePack. Omit to regenerate via Anthropic. */
  pack?: ResumePackInput;
  /**
   * If true and the master is DOCX, the artifact is the edit-in-place flavour.
   * Set this only for the DOCX export endpoint; the PDF endpoint always wants
   * a rebuild artifact (which has a parsed structure).
   */
  preferEdit?: boolean;
}

interface ArtifactCommon {
  filenameStem: string;
  masterFormat: "pdf" | "docx";
  resolvedPack: ResumePackInput;
}

export type ExportArtifact =
  | (ArtifactCommon & {
      kind: "rebuild";
      /** Parsed master + applied rewrites; consumed by render-docx + render-pdf. */
      merged: MergeResult;
    })
  | (ArtifactCommon & {
      kind: "edit";
      /** Original DOCX buffer; consumed by render-docx-edit. */
      originalBuffer: Buffer;
    });

class ExportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export { ExportError };

export async function buildExportArtifact({
  userId,
  applicationId,
  pack,
  preferEdit = false,
}: BuildExportInput): Promise<ExportArtifact> {
  // ── Load application + job + master Resume ──────────────────────────────
  const application = await db.application.findUnique({
    where: { id: applicationId, userId },
    include: { job: true, resume: true },
  });
  if (!application) throw new ExportError("Application not found", 404);

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

  // Detect by magic bytes first, fall back to URL extension
  const sigPdf = masterBuffer.subarray(0, 4).toString("ascii") === "%PDF";
  const sigZip = masterBuffer.subarray(0, 2).toString("ascii") === "PK";
  const isPdf = sigPdf || (!sigZip && /\.pdf(\?|$)/i.test(master.fileUrl));
  const isDocx = !isPdf && (sigZip || /\.docx(\?|$)/i.test(master.fileUrl));

  if (!isPdf && !isDocx) {
    throw new ExportError("Master resume must be a PDF or DOCX file.", 400);
  }

  // ── Resolve the ResumePack (use supplied or regenerate) ─────────────────
  const resolvedPack = pack ?? (await regeneratePack(userId, application.jobId));

  // Build a sensible download stem
  const filenameStem = await buildFilenameStem(masterBuffer, isPdf, application);

  // ── Dispatch based on format and preferEdit hint ────────────────────────
  if (isDocx && preferEdit) {
    return {
      kind: "edit",
      originalBuffer: masterBuffer,
      filenameStem,
      masterFormat: "docx",
      resolvedPack,
    };
  }

  // Rebuild path (always for PDF master + PDF export of DOCX master)
  const structure = isPdf
    ? await parsePdfMaster(masterBuffer)
    : await parseDocxMaster(masterBuffer);
  const merged = mergePackIntoStructure(structure, resolvedPack);

  return {
    kind: "rebuild",
    merged,
    filenameStem,
    masterFormat: isPdf ? "pdf" : "docx",
    resolvedPack,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function regeneratePack(userId: string, jobId: string): Promise<ResumePackInput> {
  const [userProfile, bullets, careerContext, job] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.bullet.findMany({ where: { userId } }),
    assembleContext(userId, resumePackSlices()),
    db.job.findUnique({ where: { id: jobId } }),
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
  if (!job) throw new ExportError("Job not found", 404);

  return generateResumePack({
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

async function buildFilenameStem(
  masterBuffer: Buffer,
  isPdf: boolean,
  application: { job: { company: string; title: string } }
): Promise<string> {
  // Cheap candidate-name guess: parse a few lines of the master.
  // Using a cheap heuristic instead of a full parse to keep the hot path quick.
  let candidateName = "Resume";
  try {
    if (isPdf) {
      const { parsePdfMaster } = await import("./parse-pdf");
      const struct = await parsePdfMaster(masterBuffer);
      candidateName = struct.contact.name?.split(/\s+/).pop() ?? "Resume";
    } else {
      const { parseDocxMaster } = await import("./parse-docx");
      const struct = await parseDocxMaster(masterBuffer);
      candidateName = struct.contact.name?.split(/\s+/).pop() ?? "Resume";
    }
  } catch {
    /* fall through to default */
  }

  const namePart = candidateName.replace(/[^\w]/g, "");
  const companyPart = application.job.company.replace(/[^\w]/g, "").slice(0, 40);
  const rolePart = application.job.title
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);

  return [namePart, companyPart, rolePart].filter(Boolean).join("-");
}
