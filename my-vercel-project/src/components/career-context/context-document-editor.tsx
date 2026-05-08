"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ContextDocumentType } from "@prisma/client";

interface ContextDocumentEditorProps {
  type: ContextDocumentType;
  initialContent: string;
}

const DOC_META: Record<
  ContextDocumentType,
  {
    label: string;
    description: string;
    placeholder: string;
    usedFor: string[];
  }
> = {
  career_strategy: {
    label: "Career Strategy",
    description:
      "Your goals, trajectory, and what you're optimising for right now. This shapes how the AI frames fit and rationale.",
    placeholder: `## What I'm optimising for
I'm looking for a senior IC role at a product-led company where I can go deep on a specific problem space. I want to avoid large-enterprise bureaucracy and prioritise autonomy and scope.

## Where I want to be in 2 years
Leading a product area as a Group PM or moving toward a Head of Product role at a Series B–D company.

## What "good" looks like for my next role
- Clear product strategy from leadership
- A team that moves fast and ships
- Equity that could actually matter
- No travel requirement

## What I'm avoiding
- Politics-heavy environments
- Roles without engineering ownership
- Titles that sound senior but aren't`,
    usedFor: [
      "Strategic fit analysis",
      "Queue rationale",
      "Cover letter angle selection",
    ],
  },
  positioning: {
    label: "Positioning",
    description:
      "How you want to be perceived. Your unique angle and narrative arc. The AI uses this to open and frame cover letters.",
    placeholder: `## My positioning
I'm a product manager who sits at the intersection of data and growth — I'm most effective when I can instrument a product, run structured experiments, and turn learning loops into compounding outcomes.

## What makes me different
Most PMs I've worked with are either strong on execution or strong on strategy. I've built enough from 0→1 to care about craft, but I've also scaled products to millions of users, so I can hold both.

## My narrative arc
Started as an analyst → moved into product through a growth role → spent 4 years at Series A/B companies owning full product lines → now looking for more scope and leadership.

## How I like to be described
Pragmatic. Evidence-driven. Comfortable with ambiguity. Obsessed with the user's actual problem, not the solution we originally assumed.`,
    usedFor: [
      "Cover letter intro and framing",
      "Resume summary generation",
      "Headline generation",
    ],
  },
  experience_library: {
    label: "Experience Library",
    description:
      "Your curated proof points. Key projects, metrics, and achievements in your own words. The AI uses these for bullet rewrites and body copy.",
    placeholder: `## Project: Checkout Redesign (2023, Acme Corp)
Rebuilt the checkout flow from scratch. Reduced drop-off by 31% and increased conversion by 18% in the first 90 days. Led a team of 2 engineers and 1 designer. Used Mixpanel + Amplitude for instrumentation.

## Project: Pricing Experiment Program (2022–2023)
Built an experiment framework that let us run 6 concurrent pricing tests. Generated $2.1M in attributed ARR uplift in year one. Previously we ran 1–2 tests per quarter; we scaled to 1–2 per week.

## Achievement: 0→1 Product Launch
Launched a B2B self-serve product in 9 months, from concept to paying customers. Wrote the PRD, ran discovery with 40+ customers, coordinated go-to-market with Sales and Marketing.

## Achievement: Team Building
Built a product team from 0 to 6 PMs over 2 years. Introduced career laddering, quarterly reviews, and a product review process that became the template for other teams.`,
    usedFor: [
      "Bullet reranking and rewrites",
      "Cover letter body copy",
      "Resume pack bullet generation",
    ],
  },
  decision_rules: {
    label: "Decision Rules",
    description:
      "Explicit rules for accepting or rejecting opportunities. The AI uses these to flag risks and score compliance.",
    placeholder: `## Hard rules (dealbreakers)
- Must be remote or hybrid (max 2 days/week in office)
- Must offer equity (options or RSUs)
- Company must be post-product-market fit — no pure pre-revenue
- No contract or freelance roles — full-time only
- No roles that report to Sales or Marketing (must be product-led org)

## Soft rules (flags, not dealbreakers)
- Prefer Series B–D over larger orgs
- Prefer companies with < 500 employees
- Prefer companies with a technical founder
- Flag if company has had recent layoffs in the last 12 months
- Flag if role has been open for > 60 days without explanation

## Compensation floor
- Total comp must be at or above $180K base equivalent
- Equity cliff of more than 1 year is a yellow flag`,
    usedFor: [
      "Fit scoring (decision-rule compliance dimension)",
      "Risk and watchout generation",
      "Queue card risk notes",
    ],
  },
  writing_voice: {
    label: "Writing Voice",
    description:
      "Your tone, style, and examples. The AI uses this to match your voice across all written output.",
    placeholder: `## Tone
Direct and confident, but not arrogant. I don't overuse superlatives ("passionate", "excited", "thrilled"). I write like I talk — no corporate filler.

## Things I avoid
- "I am a highly motivated individual"
- Passive voice where active is cleaner
- Vague claims without backing ("I have strong leadership skills")
- Opening with "I" — I prefer to open with the problem or the outcome

## Things I like
- Leading with outcomes, not activities
- Specificity over generality (31% not "significantly")
- Short sentences after long ones for rhythm
- Acknowledging tradeoffs — it shows intellectual honesty

## Sample writing I like
"We shipped it in 6 weeks. It wasn't perfect. But it was enough to know we were right — and fast enough that we could fix it before it mattered."`,
    usedFor: [
      "Cover letter generation (all output)",
      "Resume pack summary and bullets",
      "Any AI-written text",
    ],
  },
  target_companies: {
    label: "Target Companies",
    description:
      "Companies you actively want to work at. Notes on why, culture signals, and any contacts.",
    placeholder: `## Linear
Why: Best-in-class product craft, strong engineering culture, builds for power users. Exactly the kind of org I want to be part of.
Role I'd want: Senior PM, Core Product
Contact: None yet

## Vercel
Why: Shipping velocity is legendary. Developer-focused product = data-rich environment. I've been a customer for 2 years.
Role I'd want: PM on the platform side
Notes: They seem to run lean teams — worth researching headcount before applying.

## Retool
Why: B2B product with a strong technical user base. Complex use cases mean real product depth.
Role I'd want: Product Lead
Contact: Former colleague works on Sales there.

## Companies I'm watching but not sure about
- Figma (post-Adobe drama — unclear culture right now)
- Notion (heard middle-management is heavy)`,
    usedFor: [
      "Company alignment scoring",
      "Queue fit rationale",
      "Snapshot section in review",
    ],
  },
  decision_log: {
    label: "Decision Log",
    description:
      "A running log of significant decisions in your job search — what you accepted, rejected, and why.",
    placeholder: `## 2026-03-15 — Rejected: Head of Product at Startup X
Reason: Founding team dynamic felt off in the final round. CEO overrode the CPO's decisions publicly in a meeting I was in. Passed.

## 2026-02-28 — Passed on: Senior PM at BigCo
Reason: Role was technically senior but scope was narrow — one feature area with limited cross-functional ownership. Not what I'm looking for right now.

## 2026-01-10 — Rejected offer: Growth PM at Series B
Reason: Offer came in $40K below target comp and equity was minimal. They wouldn't move. Walked away.

## Pattern I'm noticing
I keep rejecting roles where the PM reports to Marketing. I should add that as a hard rule.`,
    usedFor: [
      "Decision support over time",
      "Pattern recognition for future scoring",
      "Context for AI recommendations",
    ],
  },
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function ContextDocumentEditor({
  type,
  initialContent,
}: ContextDocumentEditorProps) {
  const meta = DOC_META[type];
  const [content, setContent] = useState(initialContent);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showHint, setShowHint] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (text: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/context-documents/${type}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    },
    [type]
  );

  const handleChange = (val: string) => {
    setContent(val);
    // Debounce auto-save by 1.5s
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(val), 1500);
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link
            href="/career-context"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-lg">
              {meta.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHint((v) => !v)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <SaveIndicator state={saveState} />
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => save(content)}
            disabled={saveState === "saving"}
          >
            Save
          </Button>
        </div>
      </div>

      {/* "How this is used" hint */}
      {showHint && (
        <div className="mx-6 mt-4 rounded-md border border-white/[0.07] bg-white/[0.03] px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
            How this document is used:
          </p>
          <ul className="space-y-0.5">
            {meta.usedFor.map((u) => (
              <li key={u} className="text-[11px] text-muted-foreground/70 flex gap-1.5">
                <span className="text-muted-foreground/40 mt-0.5">•</span>
                {u}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 p-6 pt-4 flex flex-col gap-2">
        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={meta.placeholder}
          className="flex-1 resize-none font-mono text-[13px] leading-relaxed bg-card border-white/[0.07] focus-visible:ring-0 focus-visible:border-white/[0.15] min-h-[400px]"
        />
        <p className="text-[10px] text-muted-foreground/40 text-right">
          {wordCount} {wordCount === 1 ? "word" : "words"} · Markdown supported · Auto-saves
        </p>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-400/70">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-[11px] text-red-400/70">Save failed</span>
    );
  }
  return null;
}
