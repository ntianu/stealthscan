"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { ApplicationStatus, ConfidenceBand } from "@prisma/client";

// ---------------------------------------------------------------------------
// Column definitions (left → right)
// ---------------------------------------------------------------------------

const COLUMNS: {
  status: ApplicationStatus;
  label: string;
  color: string;
}[] = [
  { status: "PREPARED",     label: "Prepared",     color: "text-slate-300" },
  { status: "APPROVED",     label: "Approved",     color: "text-violet-400" },
  { status: "SUBMITTED",    label: "Submitted",    color: "text-amber-400" },
  { status: "RESPONDED",    label: "Responded",    color: "text-sky-400" },
  { status: "INTERVIEWING", label: "Interviewing", color: "text-emerald-400" },
  { status: "OFFER",        label: "Offer",        color: "text-yellow-300" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineApplication = {
  id: string;
  status: ApplicationStatus;
  fitScore: number;
  confidenceBand: ConfidenceBand | null;
  notes: string | null;
  /** ISO string — serialized from Prisma Date in the server page */
  updatedAt: string;
  job: {
    title: string;
    company: string;
    location: string | null;
  };
};

// ---------------------------------------------------------------------------
// KanbanBoard (main export)
// ---------------------------------------------------------------------------

export function KanbanBoard({
  initialApps,
}: {
  initialApps: PipelineApplication[];
}) {
  const router = useRouter();
  const [apps, setApps] = useState<PipelineApplication[]>(initialApps);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ApplicationStatus | null>(null);
  const prevStatusRef = useRef<ApplicationStatus | null>(null);

  const [search, setSearch] = useState("");
  const [fitMin, setFitMin] = useState<number>(0);
  const [showRejected, setShowRejected] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const mainApps = apps.filter((a) => {
    if (a.status === "REJECTED") return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !a.job.title.toLowerCase().includes(q) &&
        !a.job.company.toLowerCase().includes(q)
      )
        return false;
    }
    if (fitMin > 0 && a.fitScore < fitMin) return false;
    return true;
  });

  const rejectedApps = apps.filter((a) => a.status === "REJECTED");

  const appsForCol = (status: ApplicationStatus) =>
    mainApps.filter((a) => a.status === status);

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = (appId: string, status: ApplicationStatus) => {
    setDraggedId(appId);
    prevStatusRef.current = status;
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverStatus(null);
  };

  const handleDrop = async (targetStatus: ApplicationStatus) => {
    const id = draggedId;
    const prev = prevStatusRef.current;
    setDraggedId(null);
    setDragOverStatus(null);

    if (!id || !prev || prev === targetStatus) return;

    // Optimistic update
    setApps((curr) =>
      curr.map((a) =>
        a.id === id
          ? { ...a, status: targetStatus, updatedAt: new Date().toISOString() }
          : a
      )
    );

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch {
      // Rollback to previous status
      setApps((curr) =>
        curr.map((a) => (a.id === id ? { ...a, status: prev } : a))
      );
      toast.error("Failed to update status");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 3rem)" }}
    >
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-white/[0.06] bg-background/60 backdrop-blur-sm shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by role or company…"
            className="h-7 text-xs pl-8 w-56"
          />
        </div>

        {/* Fit score filter */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground mr-0.5">Fit:</span>
          {(
            [
              { label: "All", val: 0 },
              { label: "50%+", val: 0.5 },
              { label: "70%+", val: 0.7 },
            ] as const
          ).map((opt) => (
            <button
              key={opt.val}
              onClick={() => setFitMin(opt.val)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                fitMin === opt.val
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-muted-foreground">
          {mainApps.length} application{mainApps.length !== 1 ? "s" : ""}
          {rejectedApps.length > 0 &&
            ` · ${rejectedApps.length} rejected`}
        </span>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto min-h-0 px-4 py-4">
        <div className="flex gap-3 h-full min-w-max">
          {COLUMNS.map((col) => {
            const colApps = appsForCol(col.status);
            const isOver = dragOverStatus === col.status;

            return (
              <div
                key={col.status}
                className={`flex flex-col w-[255px] h-full rounded-lg border transition-colors ${
                  isOver
                    ? "border-primary/40 bg-primary/[0.03]"
                    : "border-white/[0.07] bg-card/30"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(col.status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStatus(null);
                  }
                }}
                onDrop={() => handleDrop(col.status)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] shrink-0">
                  <span className={`text-xs font-semibold ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 rounded-full px-1.5 py-px">
                    {colApps.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
                  {colApps.map((app) => (
                    <PipelineCard
                      key={app.id}
                      app={app}
                      isDragging={draggedId === app.id}
                      onDragStart={() =>
                        handleDragStart(app.id, app.status)
                      }
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {colApps.length === 0 && (
                    <div
                      className={`flex items-center justify-center h-14 rounded-md border border-dashed text-[11px] transition-colors ${
                        isOver
                          ? "border-primary/40 text-primary/60"
                          : "border-white/[0.05] text-muted-foreground/30"
                      }`}
                    >
                      {isOver ? "Drop here" : "Empty"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejected section */}
      {rejectedApps.length > 0 && (
        <div className="px-6 py-3 border-t border-white/[0.06] shrink-0">
          <button
            onClick={() => setShowRejected((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRejected ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Rejected ({rejectedApps.length})
          </button>

          {showRejected && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 max-h-32 overflow-y-auto">
              {rejectedApps.map((app) => (
                <Link key={app.id} href={`/queue/${app.id}`}>
                  <div className="rounded border border-white/[0.05] bg-muted/20 px-2.5 py-2 text-xs hover:bg-muted/30 transition-colors">
                    <p className="font-medium text-muted-foreground/70 truncate">
                      {app.job.company}
                    </p>
                    <p className="text-muted-foreground/40 truncate text-[10px]">
                      {app.job.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PipelineCard
// ---------------------------------------------------------------------------

const scoreColor = (pct: number) =>
  pct >= 70
    ? "text-emerald-400"
    : pct >= 50
      ? "text-amber-400"
      : "text-red-400";

function PipelineCard({
  app,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  app: PipelineApplication;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const pct = Math.round(app.fitScore * 100);

  return (
    <Link
      href={`/queue/${app.id}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        // Prevent navigation when the drag just ended on this card
        if (isDragging) e.preventDefault();
      }}
      className={`block rounded-md border px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing hover:border-white/[0.14] hover:bg-card/80 ${
        isDragging
          ? "opacity-40 border-white/[0.05] bg-card"
          : "opacity-100 border-white/[0.07] bg-card"
      }`}
    >
      {/* Company + score */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted-foreground leading-none truncate">
          {app.job.company}
          {app.job.location ? ` · ${app.job.location}` : ""}
        </p>
        <span
          className={`text-xs font-bold tabular-nums shrink-0 leading-none ${scoreColor(pct)}`}
        >
          {pct}%
        </span>
      </div>

      {/* Job title */}
      <p className="mt-1 text-xs font-semibold leading-snug line-clamp-2">
        {app.job.title}
      </p>

      {/* Notes preview */}
      {app.notes && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/60 line-clamp-1">
          {app.notes}
        </p>
      )}

      {/* Time ago */}
      <p className="mt-1.5 text-[10px] text-muted-foreground/40">
        {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
      </p>
    </Link>
  );
}
