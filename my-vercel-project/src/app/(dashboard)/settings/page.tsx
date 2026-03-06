import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserProfileForm } from "@/components/settings/user-profile-form";

export default async function SettingsPage() {
  const user = await requireUser();

  const userProfile = await db.userProfile.findUnique({
    where: { userId: user.id },
  });

  return (
    <>
      <Topbar title="Settings" description="Account preferences and professional profile" />
      <div className="p-6 space-y-6 max-w-3xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-muted-foreground">
            <p><span className="text-foreground/70 font-medium">Email</span> · {user.email}</p>
            <p><span className="text-foreground/70 font-medium">Name</span> · {user.name ?? "—"}</p>
            <p>
              <span className="text-foreground/70 font-medium">Member since</span> ·{" "}
              {user.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Professional profile</h2>
          <p className="text-xs text-muted-foreground mb-5">
            The more detail you add, the better the AI matching and cover-letter quality.
          </p>
          <UserProfileForm
            initial={
              userProfile
                ? {
                    currentTitle:    userProfile.currentTitle,
                    yearsExperience: userProfile.yearsExperience,
                    targetRoles:     userProfile.targetRoles,
                    skills:          userProfile.skills,
                    industries:      userProfile.industries,
                    workAuth:        userProfile.workAuth,
                    linkedinUrl:     userProfile.linkedinUrl,
                    githubUrl:       userProfile.githubUrl,
                    portfolioUrl:    userProfile.portfolioUrl,
                  }
                : null
            }
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">LinkedIn session</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              To enable LinkedIn Easy Apply scraping, paste your{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">li_at</code> cookie value.
              Stored encrypted, used only for job discovery.
            </p>
            <p className="text-amber-500/80">
              LinkedIn session configuration coming in a future update.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
