"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp,
  Copy, Sparkles, TrendingUp, BarChart2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Seniority = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE";
type BulletCategory =
  | "achievement" | "leadership" | "technical" | "cross_functional"
  | "growth" | "stakeholder" | "data_driven" | "operational";
type VariantSource = "AI_GENERATED" | "USER_EDITED";

interface BulletVariant {
  id: string;
  bulletId: string;
  roleFamily: string;
  content: string;
  source: VariantSource;
  approved: boolean;
  applicationId: string | null;
  createdAt: Date | string;
}

interface Bullet {
  id: string;
  content: string;
  competencyTags: string[];
  industryTags: string[];
  roleTags: string[];
  seniority: Seniority;
  proofStrength: number;
  category: BulletCategory | null;
  context: string | null;
  useCount: number;
  winRate: number | null;
  /** Date from Prisma (server) or ISO string after serialization (client) */
  lastUsedAt: Date | string | null;
  variants: BulletVariant[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SENIORITY_LEVELS: Seniority[] = ["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"];
const STRENGTH_LABELS = ["","Weak","Basic","Good","Strong","Exceptional"];

const CATEGORIES: { value: BulletCategory; label: string; color: string }[] = [
  { value: "achievement",     label: "Achievement",     color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "leadership",      label: "Leadership",      color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { value: "technical",       label: "Technical",       color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "cross_functional",label: "Cross-functional",color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "growth",          label: "Growth",          color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "stakeholder",     label: "Stakeholder",     color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "data_driven",     label: "Data-driven",     color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  { value: "operational",     label: "Operational",     color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
];

function categoryMeta(cat: BulletCategory | null) {
  return CATEGORIES.find((c) => c.value === cat) ?? null;
}

// ─── BulletForm ───────────────────────────────────────────────────────────────

function BulletForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Bullet>;
  onSave: (data: Omit<Bullet, "id" | "useCount" | "winRate" | "lastUsedAt" | "variants">) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [competencyTags, setCompetencyTags] = useState<string[]>(initial?.competencyTags ?? []);
  const [industryTags, setIndustryTags] = useState<string[]>(initial?.industryTags ?? []);
  const [roleTags, setRoleTags] = useState<string[]>(initial?.roleTags ?? []);
  const [seniority, setSeniority] = useState<Seniority>(initial?.seniority ?? "MID");
  const [proofStrength, setProofStrength] = useState(initial?.proofStrength ?? 3);
  const [category, setCategory] = useState<BulletCategory | null>(initial?.category ?? null);
  const [context, setContext] = useState(initial?.context ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) { toast.error("Bullet content is required"); return; }
    setSaving(true);
    try {
      await onSave({
        content, competencyTags, industryTags, roleTags, seniority, proofStrength,
        category, context: context.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.06]">
      <CardContent className="pt-4 space-y-3">
        {/* Content */}
        <div>
          <Label className="text-xs font-medium">Achievement bullet *</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder='e.g. "Led migration of 4 services to Kubernetes, cutting deployment time by 40%"'
            rows={3}
            className="mt-1"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">Be specific. Numbers = higher proof strength.</p>
        </div>

        {/* Private context */}
        <div>
          <Label className="text-xs font-medium">
            Private context{" "}
            <span className="font-normal text-muted-foreground">
              — background for AI, never shown on resume
            </span>
          </Label>
          <Textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder='e.g. "This was at Stripe during Series B hypergrowth. I owned infra but also managed 3 contractors."'
            rows={2}
            className="mt-1 text-sm"
          />
        </div>

        {/* Category */}
        <div>
          <Label className="text-xs font-medium">Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(category === cat.value ? null : cat.value)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  category === cat.value
                    ? cat.color + " font-medium"
                    : "border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags + seniority */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Competency tags</Label>
            <TagInput value={competencyTags} onChange={setCompetencyTags} placeholder="leadership, sql…" className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Role tags</Label>
            <TagInput value={roleTags} onChange={setRoleTags} placeholder="backend, pm…" className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Industry tags</Label>
            <TagInput value={industryTags} onChange={setIndustryTags} placeholder="fintech, saas…" className="mt-1 text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <Label className="text-xs">Seniority</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {SENIORITY_LEVELS.map(s => (
                <button key={s} type="button" onClick={() => setSeniority(s)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${seniority === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">
              Proof strength:{" "}
              <span className="font-semibold text-amber-400">
                {STRENGTH_LABELS[proofStrength]} ({proofStrength}/5)
              </span>
            </Label>
            <input
              type="range" min={1} max={5} value={proofStrength}
              onChange={e => setProofStrength(parseInt(e.target.value))}
              className="mt-1 w-40 accent-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── VariantRow ───────────────────────────────────────────────────────────────

function VariantRow({
  bulletId,
  variant,
  onUpdate,
  onDelete,
}: {
  bulletId: string;
  variant: BulletVariant;
  onUpdate: (v: BulletVariant) => void;
  onDelete: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const toggleApprove = async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/bullets/${bulletId}/variants/${variant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !variant.approved }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate(updated);
    } catch {
      toast.error("Failed to update variant");
    } finally {
      setToggling(false);
    }
  };

  const copyContent = () => {
    navigator.clipboard.writeText(variant.content);
    toast.success("Copied to clipboard");
  };

  const deleteVariant = async () => {
    const res = await fetch(`/api/bullets/${bulletId}/variants/${variant.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete variant"); return; }
    onDelete(variant.id);
  };

  return (
    <div className={`rounded-md border p-3 text-sm ${variant.approved ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {variant.roleFamily}
            </span>
            {variant.source === "USER_EDITED" && (
              <span className="text-[10px] text-muted-foreground">edited</span>
            )}
            {variant.approved && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-400">
                <Check className="h-2.5 w-2.5" /> approved
              </span>
            )}
          </div>
          <p className="text-foreground leading-relaxed">{variant.content}</p>
        </div>
        <div className="shrink-0 flex gap-1">
          <Button
            size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={copyContent} title="Copy"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="icon" variant="ghost"
            className={`h-6 w-6 ${variant.approved ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-400"}`}
            onClick={toggleApprove} disabled={toggling} title={variant.approved ? "Un-approve" : "Approve"}
          >
            {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button
            size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            onClick={deleteVariant} title="Delete variant"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── BulletCard ───────────────────────────────────────────────────────────────

function BulletCard({
  bullet,
  onEdit,
  onDelete,
  onVariantUpdate,
  onVariantDelete,
}: {
  bullet: Bullet;
  onEdit: () => void;
  onDelete: () => void;
  onVariantUpdate: (bulletId: string, v: BulletVariant) => void;
  onVariantDelete: (bulletId: string, variantId: string) => void;
}) {
  const [variantsOpen, setVariantsOpen] = useState(false);
  const cat = categoryMeta(bullet.category);

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed">{bullet.content}</p>

            {/* Context snippet */}
            {bullet.context && (
              <p className="mt-1 text-xs text-muted-foreground italic line-clamp-1">
                {bullet.context}
              </p>
            )}

            {/* Tags */}
            <div className="mt-2 flex flex-wrap gap-1">
              {cat && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>
                  {cat.label}
                </span>
              )}
              {bullet.competencyTags.map(t => (
                <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t}</span>
              ))}
              {bullet.roleTags.map(t => (
                <span key={t} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-400">{t}</span>
              ))}
              {bullet.industryTags.map(t => (
                <span key={t} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">{t}</span>
              ))}
            </div>

            {/* Stats row */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="font-medium text-amber-400">
                {STRENGTH_LABELS[bullet.proofStrength]} · {bullet.seniority}
              </span>
              {bullet.useCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <BarChart2 className="h-2.5 w-2.5" />
                  Used {bullet.useCount}×
                </span>
              )}
              {bullet.winRate !== null && (
                <span className={`flex items-center gap-0.5 font-medium ${bullet.winRate >= 0.5 ? "text-emerald-400" : "text-muted-foreground"}`}>
                  <TrendingUp className="h-2.5 w-2.5" />
                  {Math.round(bullet.winRate * 100)}% win rate
                </span>
              )}
            </div>

            {/* Variants accordion */}
            {bullet.variants.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setVariantsOpen(o => !o)}
                  className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {bullet.variants.length} AI adaptation{bullet.variants.length > 1 ? "s" : ""}
                  {variantsOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                </button>
                {variantsOpen && (
                  <div className="mt-2 space-y-2">
                    {bullet.variants.map(v => (
                      <VariantRow
                        key={v.id}
                        bulletId={bullet.id}
                        variant={v}
                        onUpdate={(updated) => onVariantUpdate(bullet.id, updated)}
                        onDelete={(id) => onVariantDelete(bullet.id, id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost"
                className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── BulletEditor ─────────────────────────────────────────────────────────────

export interface BulletEditorProps {
  initialBullets: Bullet[];
}

export function BulletEditor({ initialBullets }: BulletEditorProps) {
  const [bullets, setBullets] = useState<Bullet[]>(initialBullets);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<BulletCategory | "all">("all");

  // ── CRUD handlers ──

  const handleAdd = async (data: Omit<Bullet, "id" | "useCount" | "winRate" | "lastUsedAt" | "variants">) => {
    const res = await fetch("/api/bullets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { toast.error("Failed to add bullet"); return; }
    const bullet = await res.json();
    setBullets(prev => [{ ...bullet, variants: bullet.variants ?? [] }, ...prev]);
    setAdding(false);
    toast.success("Bullet added");
  };

  const handleEdit = async (id: string, data: Omit<Bullet, "id" | "useCount" | "winRate" | "lastUsedAt" | "variants">) => {
    const res = await fetch(`/api/bullets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { toast.error("Failed to update bullet"); return; }
    const updated = await res.json();
    setBullets(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b));
    setEditingId(null);
    toast.success("Bullet updated");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bullets/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete bullet"); return; }
    setBullets(prev => prev.filter(b => b.id !== id));
    toast.success("Bullet deleted");
  };

  const handleVariantUpdate = useCallback((bulletId: string, updated: BulletVariant) => {
    setBullets(prev => prev.map(b =>
      b.id === bulletId
        ? { ...b, variants: b.variants.map(v => v.id === updated.id ? updated : v) }
        : b
    ));
  }, []);

  const handleVariantDelete = useCallback((bulletId: string, variantId: string) => {
    setBullets(prev => prev.map(b =>
      b.id === bulletId
        ? { ...b, variants: b.variants.filter(v => v.id !== variantId) }
        : b
    ));
  }, []);

  // ── Filter ──

  const filtered = categoryFilter === "all"
    ? bullets
    : bullets.filter(b => b.category === categoryFilter);

  // ── Stats ──

  const totalVariants = bullets.reduce((sum, b) => sum + b.variants.length, 0);
  const bulletsWithWinRate = bullets.filter(b => b.winRate !== null);
  const avgWinRate = bulletsWithWinRate.length > 0
    ? bulletsWithWinRate.reduce((sum, b) => sum + b.winRate!, 0) / bulletsWithWinRate.length
    : null;

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      {bullets.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{bullets.length}</span> bullets</span>
          {totalVariants > 0 && (
            <span><span className="font-semibold text-foreground">{totalVariants}</span> AI adaptations</span>
          )}
          {avgWinRate !== null && (
            <span>
              <span className="font-semibold text-emerald-400">{Math.round(avgWinRate * 100)}%</span> avg win rate
            </span>
          )}
        </div>
      )}

      {/* Category filter */}
      {bullets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              categoryFilter === "all"
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            All ({bullets.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = bullets.filter(b => b.category === cat.value).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategoryFilter(cat.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  categoryFilter === cat.value
                    ? cat.color + " font-medium"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Add button */}
      {!adding && (
        <Button onClick={() => setAdding(true)} variant="outline" className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" /> Add achievement bullet
        </Button>
      )}

      {adding && (
        <BulletForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {/* Empty state */}
      {bullets.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No bullets yet. Click above to add your first achievement.
        </div>
      )}

      {/* Filter empty state */}
      {filtered.length === 0 && bullets.length > 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          No bullets in this category yet.
        </div>
      )}

      {/* Bullet list */}
      {filtered.map(bullet => (
        <div key={bullet.id}>
          {editingId === bullet.id ? (
            <BulletForm
              initial={bullet}
              onSave={(data) => handleEdit(bullet.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <BulletCard
              bullet={bullet}
              onEdit={() => setEditingId(bullet.id)}
              onDelete={() => handleDelete(bullet.id)}
              onVariantUpdate={handleVariantUpdate}
              onVariantDelete={handleVariantDelete}
            />
          )}
        </div>
      ))}
    </div>
  );
}
