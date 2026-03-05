import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <Topbar title="Settings" />
      <div className="p-6 space-y-6">
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
