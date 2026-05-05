import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateResumePack } from "@/lib/ai/resume-pack";
import { assembleContext, resumePackSlices } from "@/lib/context/assemble";

/**
 * Normalize a job title to a stable role-family key for BulletVariant storage.
 * e.g. "Senior Product Manager — Growth" → "product manager"
 */
function normalizeRoleFamily(title: string): string {
  const stripped = title
    .toLowerCase()
    .replace(/[—–-].+$/, "") // drop subtitle after dash/em-dash
    .replace(
      /\b(senior|sr\.?|lead|staff|principal|junior|jr\.?|associate|assoc\.?|head of|vp of|vp,?|vice president(?: of)?|director(?: of)?|chief|founding?)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  return (stripped || title.toLowerCase()).slice(0, 60);
}

/**
 * Find a bullet in the lookup map by matching AI's "original" text.
 * The AI may return the bullet with or without a number prefix / [tags: ...] suffix.
 */
function findBulletId(
  original: string,
  map: Map<string, string>
): string | null {
  const clean = original.trim();
  if (map.has(clean)) return map.get(clean)!;

  const stripped = clean
    .replace(/^\d+\.\s+/, "")            // strip "1. " prefix
    .replace(/\s+\[tags:[^\]]*\]$/, "")  // strip " [tags: ...]" suffix
    .trim();

  if (map.has(stripped)) return map.get(stripped)!;

  // Fuzzy: original contains the bullet content
  for (const [content, id] of map) {
    if (original.includes(content)) return id;
  }
  return null;
}

/**
 * POST /api/applications/[id]/resume-pack
 * Generates a tailored resume pack for this job.
 * Saves AI rewrites as BulletVariants and tracks selectedBulletIds on the application.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findUnique({
    where: { id, userId: user.id },
    include: { job: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const [userProfile, bullets, careerContext] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.bullet.findMany({ where: { userId: user.id } }),
    assembleContext(user.id, resumePackSlices()),
  ]);

  if (!userProfile) {
    return NextResponse.json(
      { error: "Complete your Professional Profile in Settings first." },
      { status: 400 }
    );
  }

  if (bullets.length === 0) {
    return NextResponse.json(
      { error: "Add some skill bullets in Settings → Resumes → Bullets first." },
      { status: 400 }
    );
  }

  const job = application.job;

  const pack = await generateResumePack({
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

  // ── Persist variants + track selected bullets (non-fatal) ──────────────────
  try {
    const contentToId = new Map(bullets.map((b) => [b.content.trim(), b.id]));
    const roleFamily = normalizeRoleFamily(job.title);
    const selectedIds: string[] = [];

    await Promise.allSettled(
      pack.bullets.map(async (item) => {
        const bulletId = findBulletId(item.original, contentToId);
        if (!bulletId) return;

        selectedIds.push(bulletId);

        // Only overwrite if not yet approved by the user
        const existing = await db.bulletVariant.findUnique({
          where: { bulletId_roleFamily: { bulletId, roleFamily } },
          select: { approved: true },
        });

        if (!existing || !existing.approved) {
          await db.bulletVariant.upsert({
            where: { bulletId_roleFamily: { bulletId, roleFamily } },
            create: {
              bulletId,
              roleFamily,
              content: item.rewritten,
              source: "AI_GENERATED",
              applicationId: id,
            },
            update: {
              content: item.rewritten,
              source: "AI_GENERATED",
              applicationId: id,
              approved: false,
            },
          });
        }

        // Increment use counter
        await db.bullet.update({
          where: { id: bulletId },
          data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      })
    );

    const uniqueIds = [...new Set(selectedIds)];
    if (uniqueIds.length > 0) {
      await db.application.update({
        where: { id },
        data: { selectedBulletIds: uniqueIds },
      });
    }
  } catch (err) {
    console.warn("[resume-pack] failed to persist variants:", err);
  }

  return NextResponse.json(pack);
}
