"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, ExternalLink } from "lucide-react";

export function AddJobDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add job");
        return;
      }
      if (data.alreadyExists) {
        toast.info("Already in your queue", {
          action: { label: "View", onClick: () => router.push(`/queue/${data.applicationId}`) },
        });
      } else {
        toast.success("Job added to queue!", {
          action: { label: "Review", onClick: () => router.push(`/queue/${data.applicationId}`) },
        });
      }
      setUrl("");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to add job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Job
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add job by URL</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Paste a link to any job posting — LinkedIn, Greenhouse, Lever, company career page, etc.
              The details will be auto-filled and added to your review queue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Job posting URL</Label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://boards.greenhouse.io/…"
                  className="text-xs h-8"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={url ? "inline-flex items-center" : "hidden"}
                >
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="text-xs gap-1.5" onClick={handleAdd} disabled={loading || !url.trim()}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add to queue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
