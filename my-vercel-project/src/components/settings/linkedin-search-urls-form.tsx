"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface LinkedInSearchUrlsFormProps {
  profileId: string;
  initialUrls: string[];
}

export function LinkedInSearchUrlsForm({ profileId, initialUrls }: LinkedInSearchUrlsFormProps) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  const addUrl = (raw: string) => {
    const url = raw.trim(); // preserve case — URLs are case-sensitive
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes("linkedin.com")) {
        toast.error("Must be a LinkedIn URL");
        return;
      }
      if (urls.includes(url)) {
        toast.error("URL already added");
        return;
      }
      setUrls((prev) => [...prev, url]);
      setInputValue("");
    } catch {
      toast.error("Invalid URL");
    }
  };

  const removeUrl = (url: string) => setUrls((prev) => prev.filter((u) => u !== url));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinSearchUrls: urls }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to save");
      }
      toast.success("LinkedIn searches saved");
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">LinkedIn job search URLs</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addUrl(inputValue); }
            }}
            placeholder="Paste a LinkedIn jobs search URL and press Enter…"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => addUrl(inputValue)}
          >
            Add
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Go to <strong>linkedin.com/jobs/search</strong>, set your exact filters (role, location,
          date posted, job type, etc.), then copy the URL from your browser and paste it here.
          Each URL is used as a dedicated Apify search on every scan.
        </p>
      </div>

      {urls.length > 0 && (
        <ul className="space-y-1.5">
          {urls.map((url) => {
            let label = url;
            try {
              const p = new URL(url);
              const kw = p.searchParams.get("keywords") ?? "";
              const loc = p.searchParams.get("location") ?? "";
              label = [kw, loc].filter(Boolean).join(" · ") || url.slice(0, 60);
            } catch { /* keep full url */ }
            return (
              <li key={url} className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/30 px-3 py-1.5">
                <span className="truncate text-xs text-foreground/80" title={url}>{label}</span>
                <button
                  type="button"
                  onClick={() => removeUrl(url)}
                  className="shrink-0 rounded hover:bg-destructive/10 p-0.5"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

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
