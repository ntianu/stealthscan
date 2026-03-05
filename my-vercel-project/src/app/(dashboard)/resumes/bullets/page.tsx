import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

const strengthLabels = ["", "Weak", "Basic", "Good", "Strong", "Exceptional"];

export default async function BulletsPage() {
  const user = await requireUser();

  const bullets = await db.bullet.findMany({
    where: { userId: user.id },
    orderBy: [{ proofStrength: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <Topbar title="Bullet Library" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{bullets.length} bullet(s)</p>
          <Button>
            <Plus className="h-4 w-4 mr-1" /> Add Bullet
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          These achievement bullets are tagged and pulled into cover letters and resume customizations.
          Rate proof strength 1–5: 5 = quantified outcome with specific numbers.
        </p>

        {bullets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p className="font-medium">No bullets yet.</p>
              <p className="text-sm mt-1">
                Add achievement bullets from your experience. Example: "Led migration of 3 microservices to Kubernetes, reducing deployment time by 40%."
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bullets.map((bullet) => (
              <Card key={bullet.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-gray-800">{bullet.content}</p>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-medium text-amber-600">
                        {strengthLabels[bullet.proofStrength]} ({bullet.proofStrength}/5)
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 justify-end">
                        {bullet.competencyTags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
