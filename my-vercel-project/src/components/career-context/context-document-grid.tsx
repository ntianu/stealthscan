"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ContextDocumentType } from "@prisma/client";

interface DocItem {
  type: ContextDocumentType;
  hasContent: boolean;
  updatedAt: string | null;
  wordCount: number;
}

interface ContextDocumentGridProps {
  items: DocItem[];
}

const DOC_META: Record<
  ContextDocumentType,
  { label: string; description: string; usedFor: string }
> = {
  career_strategy: {
    label: "Career Strategy",
    description: "Your goals, trajectory, and what you're optimising for right now.",
    usedFor: "Fit scoring, rationale, strategic alignment analysis",
  },
  positioning: {
    label: "Positioning",
    description: "How you want to be perceived. Your unique value proposition and narrative arc.",
    usedFor: "Cover letter angle, summary generation, resume pack",
  },
  experience_library: {
    label: "Experience Library",
    description: "Curated proof: key projects, metrics, and achievements in your own words.",
    usedFor: "Bullet rewrites, cover letter body, resume pack bullets",
  },
  decision_rules: {
    label: "Decision Rules",
    description: "Explicit criteria for accepting or rejecting opportunities.",
    usedFor: "Fit scoring, risk flagging, watchout generation",
  },
  writing_voice: {
    label: "Writing Voice",
    description: "Your tone, phrases to use or avoid, and examples of writing you like.",
    usedFor: "Cover letter generation, all written AI output",
  },
  target_companies: {
    label: "Target Companies",
    description: "Companies you want to work at, with notes on why and what you know about them.",
    usedFor: "Company alignment scoring, fit rationale, watchouts",
  },
  decision_log: {
    label: "Decision Log",
    description: "Memory of past accept/reject decisions and your reasoning.",
    usedFor: "Decision support, pattern recognition over time",
  },
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days}d ago`;
}

export function ContextDocumentGrid({ items }: ContextDocumentGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
      {items.map((item) => {
        const meta = DOC_META[item.type];
        const status = item.hasContent
          ? item.wordCount > 20
            ? "ready"
            : "draft"
          : "empty";

        return (
          <Link
            key={item.type}
            href={`/career-context/${item.type}`}
            className="group block rounded-lg border border-white/[0.07] bg-card hover:border-white/[0.14] hover:bg-card/80 transition-all p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-sm font-medium text-foreground">{meta.label}</span>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {meta.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/60">
                Used for: {meta.usedFor}
              </span>
              {item.updatedAt && (
                <span className="text-[10px] text-muted-foreground/50">
                  {formatRelative(item.updatedAt)}
                </span>
              )}
            </div>
            {item.hasContent && (
              <div className="mt-2 text-[10px] text-muted-foreground/40">
                {item.wordCount} words
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: "empty" | "draft" | "ready" }) {
  if (status === "empty") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground/50 border-white/[0.06]">
        Empty
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-400/70 border-amber-400/20">
        Draft
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-400/80 border-emerald-400/20">
      Ready
    </Badge>
  );
}
