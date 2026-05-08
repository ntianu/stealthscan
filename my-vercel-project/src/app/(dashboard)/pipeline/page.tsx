import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import {
  KanbanBoard,
  type PipelineApplication,
} from "@/components/pipeline/kanban-board";

export default async function PipelinePage() {
  const user = await requireUser();

  const raw = await db.application.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      status: true,
      fitScore: true,
      confidenceBand: true,
      notes: true,
      updatedAt: true,
      job: {
        select: {
          title: true,
          company: true,
          location: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Serialize Dates to ISO strings before passing to the client component
  const apps: PipelineApplication[] = raw.map((a) => ({
    id: a.id,
    status: a.status,
    fitScore: a.fitScore,
    confidenceBand: a.confidenceBand,
    notes: a.notes,
    updatedAt: a.updatedAt.toISOString(),
    job: a.job,
  }));

  const activeCount = apps.filter((a) => a.status !== "REJECTED").length;

  return (
    <>
      <Topbar
        title="Pipeline"
        description={
          activeCount > 0
            ? `${activeCount} active application${activeCount !== 1 ? "s" : ""}`
            : "No active applications"
        }
      />
      <KanbanBoard initialApps={apps} />
    </>
  );
}
