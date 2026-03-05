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
      <Topbar title="Settings" />
      <div className="p-6 space-y-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Name:</strong> {user.name ?? "—"}</p>
            <p><strong>Member since:</strong> {user.createdAt.toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-4">Your professional profile</h2>
          <p className="text-sm text-gray-500 mb-6">
            This information is used to calculate fit scores and generate application materials. The more detail you add, the better the matching.
          </p>
          <UserProfileForm
            initial={
              userProfile
                ? {
                    currentTitle: userProfile.currentTitle,
                    yearsExperience: userProfile.yearsExperience,
                    skills: userProfile.skills,
                    industries: userProfile.industries,
                    workAuth: userProfile.workAuth,
                    linkedinUrl: userProfile.linkedinUrl,
                    githubUrl: userProfile.githubUrl,
                    portfolioUrl: userProfile.portfolioUrl,
                  }
                : null
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>LinkedIn Session</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>
              To enable LinkedIn Easy Apply scraping, paste your <code>li_at</code> cookie value below.
              This is stored encrypted and only used for job discovery.
            </p>
            <p className="text-amber-600">
              LinkedIn session cookie configuration coming in a future update.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
