import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateResumePack } from "@/lib/ai/resume-pack";
import { assembleContext, resumePackSlices } from "@/lib/context/assemble";

/**
 * POST /api/applications/[id]/resume-pack
 * Generates a tailored resume pack for this job and returns it.
 * Does not persist — content is copy-pasteable by the user.
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
      content: b.content,
      competencyTags: b.competencyTags,
      proofStrength: b.proofStrength,
    })),
    careerContext: careerContext || undefined,
  });

  return NextResponse.json(pack);
}
