import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { BulletEditor } from "@/components/resumes/bullet-editor";

export default async function BulletsPage() {
  const user = await requireUser();

  const bullets = await db.bullet.findMany({
    where: { userId: user.id },
    include: { variants: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ proofStrength: "desc" }, { createdAt: "desc" }],
  });

  const totalVariants = bullets.reduce((sum, b) => sum + b.variants.length, 0);

  const description = [
    `${bullets.length} bullet${bullets.length !== 1 ? "s" : ""}`,
    totalVariants > 0 ? `${totalVariants} AI adaptation${totalVariants !== 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Topbar
        title="Bullet Library"
        description={description || "Tagged achievements used in AI-generated materials"}
      />
      <div className="p-6 max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Achievement bullets power your cover letters and Resume Pack. Rate proof strength
          1–5 (5 = quantified outcome). When you generate a Resume Pack, Claude adapts each
          bullet for the role and saves it as an &ldquo;AI adaptation&rdquo; you can approve
          for future use.
        </p>
        <BulletEditor initialBullets={bullets} />
      </div>
    </>
  );
}
