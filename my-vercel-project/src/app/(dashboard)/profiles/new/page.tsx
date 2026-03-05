import { Topbar } from "@/components/layout/topbar";
import { SearchProfileForm } from "@/components/profiles/search-profile-form";

export default function NewProfilePage() {
  return (
    <>
      <Topbar title="New Search Profile" />
      <div className="p-6 max-w-3xl">
        <p className="mb-6 text-sm text-gray-500">
          Define your job search criteria. The daily scan will use all active profiles to find and score matching jobs.
        </p>
        <SearchProfileForm />
      </div>
    </>
  );
}
