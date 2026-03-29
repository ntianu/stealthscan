"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface QueueCardProps {
  id: string;
  jobTitle: string;
  jobCompany: string;
  jobSource: string;
  fitScore: number;
  createdAt: Date;
  resumeName: string | null;
  hasCoverLetter: boolean;
}

export function QueueCard({
  id,
  jobTitle,
  jobCompany,
  jobSource,
  fitScore,
  createdAt,
  resumeName,
  hasCoverLetter,
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
      <Card className="cursor-pointer hover:border-primary/30 transition-colors group">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold truncate">{jobTitle}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{jobCompany}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
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
                {skipping
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <X className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{jobSource}</Badge>
            {resumeName && <span className="truncate">Resume: {resumeName}</span>}
            {hasCoverLetter && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Cover letter ready</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
