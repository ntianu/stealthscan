import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { SearchProfileForm } from "@/components/profiles/search-profile-form";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const user = await requireUser();
  const { profileId } = await params;

  const profile = await db.searchProfile.findUnique({
    where: { id: profileId, userId: user.id },
  });

  if (!profile) notFound();

  return (
    <>
      <Topbar title={`Edit — ${profile.name}`} />
      <div className="p-6 max-w-3xl">
        <SearchProfileForm
          initialData={{
            id: profile.id,
            name: profile.name,
            active: profile.active,
            dailyLimit: profile.dailyLimit,
            titleIncludes: profile.titleIncludes,
            titleExcludes: profile.titleExcludes,
            locations: profile.locations,
            remoteTypes: profile.remoteTypes as never,
            minSalary: profile.minSalary?.toString(),
            maxSalary: profile.maxSalary?.toString(),
            seniority: profile.seniority as never,
            jobTypes: profile.jobTypes as never,
            industries: profile.industries,
            companyBlacklist: profile.companyBlacklist,
            companyWhitelist: profile.companyWhitelist,
            sources: profile.sources as never,
          }}
        />
      </div>
    </>
  );
}
