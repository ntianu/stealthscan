import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Target } from "lucide-react";

export default async function ProfilesPage() {
  const user = await requireUser();

  const profiles = await db.searchProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Topbar title="Search Profiles" description="Configure what jobs to discover each day" />
      <div className="p-6 space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{profiles.length} profile{profiles.length !== 1 ? "s" : ""}</p>
          <Button asChild size="sm" className="gap-1.5 text-xs">
            <Link href="/profiles/new">
              <Plus className="h-3.5 w-3.5" /> New Profile
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Search profiles define what jobs to look for. The daily cron uses all active profiles to scan job boards.
        </p>

        {profiles.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Target className="mx-auto h-8 w-8 mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No search profiles yet.</p>
              <p className="text-xs mt-1">Create a profile to define your job search criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles.map((profile) => (
              <Link key={profile.id} href={`/profiles/${profile.id}`}>
                <Card className="cursor-pointer hover:border-primary/30 transition-colors h-full">
                  <CardHeader className="pb-1.5 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold truncate">{profile.name}</CardTitle>
                      <Badge
                        variant={profile.active ? "default" : "secondary"}
                        className="text-[10px] shrink-0 ml-2"
                      >
                        {profile.active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 text-xs text-muted-foreground space-y-1">
                    {profile.titleIncludes.length > 0 && (
                      <p className="truncate">Titles: {profile.titleIncludes.join(", ")}</p>
                    )}
                    {profile.locations.length > 0 && (
                      <p className="truncate">Locations: {profile.locations.join(", ")}</p>
                    )}
                    {profile.remoteTypes.length > 0 && (
                      <p>Remote: {profile.remoteTypes.join(", ")}</p>
                    )}
                    <p>Daily limit: {profile.dailyLimit} applications</p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {profile.sources.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] h-4 px-1.5">{s}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
