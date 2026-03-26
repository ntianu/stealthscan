import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserProfileForm } from "@/components/settings/user-profile-form";
import { LocationPrefsForm } from "@/components/settings/location-prefs-form";
import { RssFeedsForm } from "@/components/settings/rss-feeds-form";
import { LinkedInSearchUrlsForm } from "@/components/settings/linkedin-search-urls-form";

export default async function SettingsPage() {
  const user = await requireUser();

  const [userProfile, firstActiveProfile] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.searchProfile.findFirst({
      where: { userId: user.id, active: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

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

        {firstActiveProfile && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Location preferences</CardTitle>
              <CardDescription className="text-xs">
                Jobs outside these locations are filtered from your feed. Leave empty to see all locations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocationPrefsForm
                profileId={firstActiveProfile.id}
                initialLocations={firstActiveProfile.locations}
              />
            </CardContent>
          </Card>
        )}

        {firstActiveProfile && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">LinkedIn job searches</CardTitle>
              <CardDescription className="text-xs">
                Paste LinkedIn search page URLs. The system runs each search via Apify on every scan — no account needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LinkedInSearchUrlsForm
                profileId={firstActiveProfile.id}
                initialUrls={firstActiveProfile.linkedinSearchUrls}
              />
            </CardContent>
          </Card>
        )}

        {firstActiveProfile && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">RSS feeds</CardTitle>
              <CardDescription className="text-xs">
                Optional: paste RSS job feed URLs (Google Alerts, niche job boards, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RssFeedsForm
                profileId={firstActiveProfile.id}
                initialFeeds={firstActiveProfile.rssFeeds}
              />
            </CardContent>
          </Card>
        )}

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
      </div>
    </>
  );
}
