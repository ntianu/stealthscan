"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/tag-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface LocationPrefsFormProps {
  profileId: string;
  initialLocations: string[];
}

export function LocationPrefsForm({ profileId, initialLocations }: LocationPrefsFormProps) {
  const [locations, setLocations] = useState<string[]>(initialLocations);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to save");
      }

      toast.success("Location preferences saved");
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Target cities / regions</Label>
        <TagInput
          value={locations}
          onChange={setLocations}
          placeholder="e.g. New York, San Francisco, London…"
          className="mt-1.5"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Press Enter or comma to add each location. Remote jobs always appear regardless of this setting.
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="px-4">
          {saving ? (
            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
