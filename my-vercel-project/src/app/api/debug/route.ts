import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/debug
 * Auth-protected diagnostic endpoint — shows DB state and what scan queries
 * would be built, without calling any external APIs.
 */
export async function GET() {
  const user = await requireUser();

  const [userProfile, searchProfiles, jobCount, appCount] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.searchProfile.findMany({ where: { userId: user.id } }),
    db.job.count(),
    db.application.count({ where: { userId: user.id } }),
  ]);

  const profileDiagnostics = searchProfiles.map((profile) => {
    const targetRoles = userProfile?.targetRoles ?? [];
    const queries =
      targetRoles.length > 0
        ? targetRoles
        : profile.titleIncludes.length > 0
        ? profile.titleIncludes
        : [profile.name];

    return {
      id: profile.id,
      name: profile.name,
      active: profile.active,
      sources: profile.sources,
      titleIncludes: profile.titleIncludes,
      remoteTypes: profile.remoteTypes,
      locations: profile.locations,
      resolvedQueries: queries.slice(0, 3),
      querySource:
        targetRoles.length > 0
          ? "targetRoles"
          : profile.titleIncludes.length > 0
          ? "titleIncludes"
          : "profileName",
    };
  });

  return NextResponse.json({
    userId: user.id,
    hasUserProfile: !!userProfile,
    targetRoles: userProfile?.targetRoles ?? [],
    skills: userProfile?.skills ?? [],
    totalJobsInDB: jobCount,
    totalApplications: appCount,
    searchProfileCount: searchProfiles.length,
    activeProfileCount: searchProfiles.filter((p) => p.active).length,
    profiles: profileDiagnostics,
  });
}
