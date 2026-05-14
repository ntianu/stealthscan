"use client";

import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirrors the batch route response)
// ---------------------------------------------------------------------------

type BatchResult =
  | { url: string; status: "added"; applicationId: string; jobId: string; title: string; company: string }
  | { url: string; status: "exists"; applicationId: string; jobId: string; title: string; company: string }
  | { url: string; status: "failed" | "invalid"; error: string };

type BatchResponse = {
  results: BatchResult[];
  counts: { added: number; exists: number; failed: number };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count lines that look like URLs */
function countValidUrls(text: string): number {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      try {
        new URL(l);
        return true;
      } catch {
        return false;
      }
    }).length;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Results summary shown after a batch import */
function BatchResults({
  data,
  onReset,
}: {
  data: BatchResponse;
  onReset: () => void;
}) {
  const router = useRouter();
  const { counts, results } = data;

  return (
    <div className="space-y-4">
      {/* Counts summary */}
      <div className="flex flex-wrap gap-3 text-xs">
        {counts.added > 0 && (
          <span className="flex items-center gap-1 text-emerald-500 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {counts.added} added
          </span>
        )}
        {counts.exists > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground font-medium">
            <Clock className="h-3.5 w-3.5" />
            {counts.exists} already in queue
          </span>
        )}
        {counts.failed > 0 && (
          <span className="flex items-center gap-1 text-destructive font-medium">
            <XCircle className="h-3.5 w-3.5" />
            {counts.failed} failed
          </span>
        )}
      </div>

      {/* Per-URL result list */}
      <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border bg-muted/30 p-2">
        {results.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-xs py-0.5">
            {r.status === "added" ? (
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
            ) : r.status === "exists" ? (
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            ) : (
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0">
              {(r.status === "added" || r.status === "exists") ? (
                <span className="font-medium truncate block">
                  {r.company} — {r.title}
                </span>
              ) : (
                <span className="text-muted-foreground truncate block">
                  {r.url}
                </span>
              )}
              {(r.status === "failed" || r.status === "invalid") && (
                <span className="text-destructive/80">{r.error}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onReset}
        >
          Import more
        </Button>
        {counts.added > 0 && (
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => router.push("/queue")}
          >
            View queue
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddJobDialog({ trigger }: { trigger?: React.ReactNode } = {}) {
  const router = useRouter();

  // --- single-URL tab state ---
  const [open, setOpen] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);

  // --- batch tab state ---
  const [pastedText, setPastedText] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResponse | null>(null);

  const validUrlCount = countValidUrls(pastedText);

  // ---------------------------------------------------------------------------
  // Single-URL handler (unchanged behaviour)
  // ---------------------------------------------------------------------------

  const handleSingleAdd = async () => {
    if (!singleUrl.trim()) return;
    setSingleLoading(true);
    try {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: singleUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add job");
        return;
      }
      if (data.alreadyExists) {
        toast.info("Already in your queue", {
          action: {
            label: "View",
            onClick: () => router.push(`/queue/${data.applicationId}`),
          },
        });
      } else {
        toast.success("Job added to queue!", {
          action: {
            label: "Review",
            onClick: () => router.push(`/queue/${data.applicationId}`),
          },
        });
      }
      setSingleUrl("");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to add job");
    } finally {
      setSingleLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Batch handler
  // ---------------------------------------------------------------------------

  const handleBatchImport = async () => {
    const urls = pastedText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        try {
          new URL(l);
          return true;
        } catch {
          return false;
        }
      });

    if (urls.length === 0) return;

    setBatchLoading(true);
    setBatchResults(null);

    try {
      const res = await fetch("/api/jobs/manual/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data: BatchResponse = await res.json();
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Batch import failed");
        return;
      }
      setBatchResults(data);
      if (data.counts.added > 0) {
        router.refresh();
      }
    } catch {
      toast.error("Batch import failed");
    } finally {
      setBatchLoading(false);
    }
  };

  const resetBatch = () => {
    setPastedText("");
    setBatchResults(null);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // Reset everything on close
      setSingleUrl("");
      resetBatch();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Job
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add jobs</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a single job by URL, or paste a list to import in bulk.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="single" className="pt-1">
            <TabsList className="h-8 text-xs">
              <TabsTrigger value="single" className="text-xs px-3 h-6">
                Single URL
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-xs px-3 h-6">
                Paste URLs
              </TabsTrigger>
            </TabsList>

            {/* ---------------------------------------------------------------- */}
            {/* Single URL tab                                                    */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent value="single" className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Job posting URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    placeholder="https://boards.greenhouse.io/…"
                    className="text-xs h-8"
                    onKeyDown={(e) => e.key === "Enter" && handleSingleAdd()}
                    autoFocus
                  />
                  <a
                    href={singleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={singleUrl ? "inline-flex items-center" : "hidden"}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={handleSingleAdd}
                  disabled={singleLoading || !singleUrl.trim()}
                >
                  {singleLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add to queue
                </Button>
              </div>
            </TabsContent>

            {/* ---------------------------------------------------------------- */}
            {/* Batch / Paste URLs tab                                            */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent value="batch" className="space-y-4 pt-3">
              {batchResults ? (
                <BatchResults data={batchResults} onReset={resetBatch} />
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        Job posting URLs
                      </Label>
                      {validUrlCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {validUrlCount} URL{validUrlCount !== 1 ? "s" : ""}
                          {validUrlCount > 20 && (
                            <span className="text-amber-500"> · first 20 will be imported</span>
                          )}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={
                        "https://boards.greenhouse.io/…\nhttps://jobs.lever.co/…\nhttps://linkedin.com/jobs/view/…"
                      }
                      className="text-xs min-h-[120px] resize-none font-mono"
                      disabled={batchLoading}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      One URL per line — LinkedIn, Greenhouse, Lever, company career pages, etc.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setOpen(false)}
                      disabled={batchLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={handleBatchImport}
                      disabled={batchLoading || validUrlCount === 0}
                    >
                      {batchLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Importing…
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Import {validUrlCount > 0 ? `${Math.min(validUrlCount, 20)} job${Math.min(validUrlCount, 20) !== 1 ? "s" : ""}` : "jobs"}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
