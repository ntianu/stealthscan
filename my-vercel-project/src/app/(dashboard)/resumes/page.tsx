import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, Plus, ExternalLink } from "lucide-react";

export default async function ResumesPage() {
  const user = await requireUser();

  const resumes = await db.resume.findMany({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Topbar title="Resume Library" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{resumes.length} resume(s) on file</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/resumes/bullets">Bullet Library</Link>
            </Button>
            <Button asChild>
              <Link href="/resumes/upload">
                <Plus className="h-4 w-4 mr-1" /> Upload Resume
              </Link>
            </Button>
          </div>
        </div>

        {resumes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileText className="mx-auto h-10 w-10 mb-3 text-gray-300" />
              <p className="font-medium">No resumes uploaded yet.</p>
              <p className="text-sm mt-1">
                Upload resume PDFs and tag them by role type so the bot can select the best one for each job.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <Card key={resume.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-semibold">{resume.name}</CardTitle>
                    {resume.isDefault && (
                      <Badge variant="default" className="text-xs">Default</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {resume.roleTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {tag}
                      </span>
                    ))}
                    {resume.domains.map((d) => (
                      <span key={d} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{resume.seniority}</span>
                    <a
                      href={resume.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      Download <ExternalLink className="h-3 w-3" />
                    </a>
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
