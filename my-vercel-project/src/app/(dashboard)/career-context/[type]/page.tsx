import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { ContextDocumentEditor } from "@/components/career-context/context-document-editor";
import type { ContextDocumentType } from "@prisma/client";

const VALID_TYPES = [
  "career_strategy",
  "positioning",
  "experience_library",
  "decision_rules",
  "writing_voice",
  "target_companies",
  "decision_log",
] as const;

function isValidType(t: string): t is ContextDocumentType {
  return VALID_TYPES.includes(t as ContextDocumentType);
}

export default async function CareerContextEditorPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  if (!isValidType(type)) notFound();

  const user = await requireUser();

  const doc = await db.contextDocument.findUnique({
    where: { userId_type: { userId: user.id, type } },
  });

  return (
    <>
      <Topbar
        title="Career Context"
        description="Strategic context that makes your AI applications smarter"
      />
      <ContextDocumentEditor
        type={type}
        initialContent={doc?.content ?? ""}
      />
    </>
  );
}
