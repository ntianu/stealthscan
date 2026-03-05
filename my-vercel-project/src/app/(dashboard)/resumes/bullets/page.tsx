import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { BulletEditor } from "@/components/resumes/bullet-editor";

export default async function BulletsPage() {
  const user = await requireUser();

  const bullets = await db.bullet.findMany({
    where: { userId: user.id },
    orderBy: [{ proofStrength: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <Topbar title="Bullet Library" />
      <div className="p-6 max-w-3xl space-y-4">
        <p className="text-sm text-gray-500">
          Achievement bullets are tagged and pulled into your cover letters automatically.
          Rate proof strength 1–5 (5 = quantified outcome with specific numbers).
        </p>
        <BulletEditor initialBullets={bullets as never} />
      </div>
    </>
  );
}
