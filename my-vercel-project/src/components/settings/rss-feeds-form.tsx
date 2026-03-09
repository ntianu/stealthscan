"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/tag-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface RssFeedsFormProps {
  profileId: string;
  initialFeeds: string[];
}

export function RssFeedsForm({ profileId, initialFeeds }: RssFeedsFormProps) {
  const [feeds, setFeeds] = useState<string[]>(initialFeeds);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rssFeeds: feeds }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to save");
      }

      toast.success("RSS feeds saved");
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Job alert RSS URLs</Label>
        <TagInput
          value={feeds}
          onChange={setFeeds}
          placeholder="Paste a LinkedIn alert RSS URL and press Enter…"
          className="mt-1.5"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          In LinkedIn, go to a job search → set your filters → click &ldquo;Create alert&rdquo; →
          open the alert email → copy the RSS link. Each feed URL is fetched on every scan.
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
