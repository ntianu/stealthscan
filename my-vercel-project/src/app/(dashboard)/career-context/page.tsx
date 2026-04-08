import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { ContextDocumentGrid } from "@/components/career-context/context-document-grid";
import type { ContextDocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CareerContextPage() {
  const user = await requireUser();

  const docs = await db.contextDocument.findMany({
    where: { userId: user.id },
    select: { type: true, updatedAt: true, content: true },
  });

  const docMap = new Map(docs.map((d) => [d.type, d]));

  const docTypes: ContextDocumentType[] = [
    "career_strategy",
    "positioning",
    "experience_library",
    "decision_rules",
    "writing_voice",
    "target_companies",
    "decision_log",
  ];

  const items = docTypes.map((type) => {
    const doc = docMap.get(type);
    return {
      type,
      hasContent: !!doc && doc.content.trim().length > 0,
      updatedAt: doc?.updatedAt?.toISOString() ?? null,
      wordCount: doc ? doc.content.trim().split(/\s+/).filter(Boolean).length : 0,
    };
  });

  return (
    <>
      <Topbar
        title="Career Context"
        description="Strategic context that makes your AI applications smarter"
      />
      <div className="p-6">
        <p className="text-xs text-muted-foreground max-w-xl mb-6">
          These documents are not public and never leave the system. They give the AI richer context
          about your goals, voice, and standards — producing cover letters and fit analysis that
          actually reflects how you think.
        </p>
        <ContextDocumentGrid items={items} />
      </div>
    </>
  );
}
