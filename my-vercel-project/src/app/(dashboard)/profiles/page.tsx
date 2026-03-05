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
      <Topbar title="Search Profiles" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{profiles.length} profile(s)</p>
          <Button asChild>
            <Link href="/profiles/new">
              <Plus className="h-4 w-4 mr-1" /> New Profile
            </Link>
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          Search profiles define what jobs to look for. The daily cron uses all active profiles to scan job boards.
        </p>

        {profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Target className="mx-auto h-10 w-10 mb-3 text-gray-300" />
              <p className="font-medium">No search profiles yet.</p>
              <p className="text-sm mt-1">Create a profile to define your job search criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {profiles.map((profile) => (
              <Link key={profile.id} href={`/profiles/${profile.id}`}>
                <Card className="cursor-pointer hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{profile.name}</CardTitle>
                      <Badge variant={profile.active ? "default" : "secondary"}>
                        {profile.active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-500 space-y-1">
                    {profile.titleIncludes.length > 0 && (
                      <p>Titles: {profile.titleIncludes.join(", ")}</p>
                    )}
                    {profile.locations.length > 0 && (
                      <p>Locations: {profile.locations.join(", ")}</p>
                    )}
                    {profile.remoteTypes.length > 0 && (
                      <p>Remote: {profile.remoteTypes.join(", ")}</p>
                    )}
                    <p>Daily limit: {profile.dailyLimit} applications</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {profile.sources.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
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
