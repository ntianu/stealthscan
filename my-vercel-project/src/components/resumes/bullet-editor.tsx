"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";

type Seniority = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE";
const SENIORITY_LEVELS: Seniority[] = ["INTERN","JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"];
const STRENGTH_LABELS = ["","Weak","Basic","Good","Strong","Exceptional"];

interface Bullet {
  id: string;
  content: string;
  competencyTags: string[];
  industryTags: string[];
  roleTags: string[];
  seniority: Seniority;
  proofStrength: number;
}

interface BulletEditorProps {
  initialBullets: Bullet[];
}

function BulletForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Bullet>;
  onSave: (data: Omit<Bullet, "id">) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [competencyTags, setCompetencyTags] = useState<string[]>(initial?.competencyTags ?? []);
  const [industryTags, setIndustryTags] = useState<string[]>(initial?.industryTags ?? []);
  const [roleTags, setRoleTags] = useState<string[]>(initial?.roleTags ?? []);
  const [seniority, setSeniority] = useState<Seniority>(initial?.seniority ?? "MID");
  const [proofStrength, setProofStrength] = useState(initial?.proofStrength ?? 3);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) { toast.error("Bullet content is required"); return; }
    setSaving(true);
    try {
      await onSave({ content, competencyTags, industryTags, roleTags, seniority, proofStrength });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="pt-4 space-y-3">
        <div>
          <Label>Achievement bullet *</Label>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder='e.g. "Led migration of 4 services to Kubernetes, cutting deployment time by 40%"'
            rows={3}
            className="mt-1 bg-white"
          />
          <p className="mt-1 text-xs text-gray-400">Be specific. Numbers = higher proof strength.</p>
        </div>

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
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${seniority === s ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-500"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Proof strength: <span className="font-semibold text-amber-600">{STRENGTH_LABELS[proofStrength]} ({proofStrength}/5)</span></Label>
            <input type="range" min={1} max={5} value={proofStrength}
              onChange={e => setProofStrength(parseInt(e.target.value))}
              className="mt-1 w-40 accent-blue-600" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1" />Cancel</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BulletEditor({ initialBullets }: BulletEditorProps) {
  const [bullets, setBullets] = useState<Bullet[]>(initialBullets);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = async (data: Omit<Bullet, "id">) => {
    const res = await fetch("/api/bullets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { toast.error("Failed to add bullet"); return; }
    const bullet = await res.json();
    setBullets(prev => [bullet, ...prev]);
    setAdding(false);
    toast.success("Bullet added");
  };

  const handleEdit = async (id: string, data: Omit<Bullet, "id">) => {
    const res = await fetch(`/api/bullets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { toast.error("Failed to update bullet"); return; }
    const updated = await res.json();
    setBullets(prev => prev.map(b => b.id === id ? updated : b));
    setEditingId(null);
    toast.success("Bullet updated");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bullets/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete bullet"); return; }
    setBullets(prev => prev.filter(b => b.id !== id));
    toast.success("Bullet deleted");
  };

  return (
    <div className="space-y-3">
      {!adding && (
        <Button onClick={() => setAdding(true)} variant="outline" className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" /> Add achievement bullet
        </Button>
      )}

      {adding && (
        <BulletForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {bullets.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400">
          No bullets yet. Click above to add your first achievement.
        </div>
      )}

      {bullets.map(bullet => (
        <div key={bullet.id}>
          {editingId === bullet.id ? (
            <BulletForm
              initial={bullet}
              onSave={(data) => handleEdit(bullet.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{bullet.content}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {bullet.competencyTags.map(t => (
                        <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t}</span>
                      ))}
                      {bullet.roleTags.map(t => (
                        <span key={t} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">{t}</span>
                      ))}
                      {bullet.industryTags.map(t => (
                        <span key={t} className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs font-medium text-amber-600">
                      {STRENGTH_LABELS[bullet.proofStrength]} · {bullet.seniority}
                    </span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(bullet.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(bullet.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ))}
    </div>
  );
}
