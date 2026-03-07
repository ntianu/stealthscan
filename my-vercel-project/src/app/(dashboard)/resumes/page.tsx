import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, Plus, ExternalLink } from "lucide-react";
import { ResumeActions } from "@/components/resumes/resume-actions";

export default async function ResumesPage() {
  const user = await requireUser();

  const resumes = await db.resume.findMany({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Topbar title="Resume Library" description="Upload and manage your resume PDFs" />
      <div className="p-6 space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{resumes.length} resume{resumes.length !== 1 ? "s" : ""} on file</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <Link href="/resumes/bullets">Bullet Library</Link>
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" asChild>
              <Link href="/resumes/upload">
                <Plus className="h-3.5 w-3.5" /> Upload Resume
              </Link>
            </Button>
          </div>
        </div>

        {resumes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No resumes uploaded yet.</p>
              <p className="text-xs mt-1">
                Upload resume PDFs and tag them by role type so the bot can select the best one for each job.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <Card key={resume.id} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-1.5 pt-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CardTitle className="text-sm font-semibold leading-snug truncate">{resume.name}</CardTitle>
                      {resume.isDefault && (
                        <Badge variant="default" className="text-[10px] shrink-0">Default</Badge>
                      )}
                    </div>
                    <ResumeActions id={resume.id} isDefault={resume.isDefault} />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2.5">
                  <div className="flex flex-wrap gap-1">
                    {resume.roleTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        {tag}
                      </span>
                    ))}
                    {resume.domains.map((d) => (
                      <span key={d} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-400">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="uppercase tracking-wide">{resume.seniority}</span>
                    <a
                      href={resume.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
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
