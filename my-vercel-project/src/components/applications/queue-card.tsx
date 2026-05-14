"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Bookmark, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ConfidenceBand = "HIGH" | "MEDIUM" | "EXPLORATORY";

interface QueueCardProps {
  id: string;
  jobTitle: string;
  jobCompany: string;
  jobLocation: string | null;
  jobSource: string;
  fitScore: number;
  confidenceBand: ConfidenceBand | null;
  rationale: string | null;
  risks: string | null;
  createdAt: Date;
  savedForLater: boolean;
}

const BAND_STYLES: Record<ConfidenceBand, string> = {
  HIGH: "text-emerald-400 border-emerald-400/30 bg-emerald-400/[0.06]",
  MEDIUM: "text-amber-400 border-amber-400/30 bg-amber-400/[0.06]",
  EXPLORATORY: "text-blue-400 border-blue-400/30 bg-blue-400/[0.06]",
};

const BAND_LABELS: Record<ConfidenceBand, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  EXPLORATORY: "Exploratory",
};

export function QueueCard({
  id,
  jobTitle,
  jobCompany,
  jobLocation,
  jobSource,
  fitScore,
  confidenceBand,
  rationale,
  risks,
  createdAt,
  savedForLater,
}: QueueCardProps) {
  const router = useRouter();
  const [skipping, setSkipping] = useState(false);
  const [gone, setGone] = useState(false);

  const pct = Math.round(fitScore * 100);
  const scoreColor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";

  const handleSkip = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSkipping(true);
    try {
      const res = await fetch(`/api/applications/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setGone(true);
      router.refresh();
    } catch {
      toast.error("Failed to skip");
      setSkipping(false);
    }
  };

  if (gone) return null;

  return (
    <Link href={`/queue/${id}`}>
      <div className="group rounded-lg border border-white/[0.07] bg-card hover:border-white/[0.14] hover:bg-card/80 transition-all px-4 py-3 cursor-pointer">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground truncate">{jobTitle}</h3>
              {savedForLater && (
                <Bookmark className="h-3 w-3 text-blue-400 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {jobCompany}{jobLocation ? ` · ${jobLocation}` : ""}
            </p>
          </div>

          {/* Score + skip */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${scoreColor}`}>{pct}%</div>
              <div className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </div>
            </div>
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
              title="Skip"
            >
              {skipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Rationale */}
        {rationale && (
          <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2">
            {rationale}
          </p>
        )}

        {/* Risk note */}
        {risks && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-400/80 leading-snug line-clamp-1">{risks}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-2.5 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{jobSource}</Badge>
          {confidenceBand && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-medium ${BAND_STYLES[confidenceBand]}`}>
              {BAND_LABELS[confidenceBand]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
