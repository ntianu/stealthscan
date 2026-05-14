import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ContextDocumentType } from "@prisma/client";
import { z } from "zod";

const VALID_TYPES = [
  "career_strategy",
  "positioning",
  "experience_library",
  "decision_rules",
  "writing_voice",
  "target_companies",
  "decision_log",
] as const;

const DOCUMENT_TITLES: Record<ContextDocumentType, string> = {
  career_strategy: "Career Strategy",
  positioning: "Positioning",
  experience_library: "Experience Library",
  decision_rules: "Decision Rules",
  writing_voice: "Writing Voice",
  target_companies: "Target Companies",
  decision_log: "Decision Log",
};

const schema = z.object({
  content: z.string().max(20000),
});

function isValidType(type: string): type is ContextDocumentType {
  return VALID_TYPES.includes(type as ContextDocumentType);
}

// GET /api/context-documents/[type]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await requireUser();
  const { type } = await params;

  if (!isValidType(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const doc = await db.contextDocument.findUnique({
    where: { userId_type: { userId: user.id, type } },
  });

  return NextResponse.json(doc ?? null);
}

// PUT /api/context-documents/[type] — upsert
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await requireUser();
  const { type } = await params;

  if (!isValidType(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { content } = parsed.data;

  // Compile: strip markdown syntax for a clean prompt-ready version
  const compiled = compileForPrompt(content);

  const doc = await db.contextDocument.upsert({
    where: { userId_type: { userId: user.id, type } },
    create: {
      userId: user.id,
      type,
      title: DOCUMENT_TITLES[type],
      content,
      compiled,
      compiledAt: new Date(),
    },
    update: {
      content,
      compiled,
      compiledAt: new Date(),
    },
  });

  return NextResponse.json(doc);
}

// DELETE /api/context-documents/[type]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await requireUser();
  const { type } = await params;

  if (!isValidType(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  await db.contextDocument.deleteMany({
    where: { userId: user.id, type },
  });

  return NextResponse.json({ ok: true });
}

// Compile markdown to clean prompt-injectable text
function compileForPrompt(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "") // strip headings markers
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/^\s*[-*+]\s+/gm, "• ") // list markers → bullet
    .replace(/^\s*\d+\.\s+/gm, "• ") // numbered list → bullet
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links → label only
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();
}
