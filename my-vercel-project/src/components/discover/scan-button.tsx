"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScanButton() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  async function handleScan() {
    setScanning(true);
    const toastId = toast.loading("Scanning job boards…");

    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Scan failed");

      const fetched: number = data.scan?.fetched ?? 0;
      const inserted: number = data.scan?.inserted ?? 0;
      const deduped: number = data.scan?.deduped ?? 0;
      const prepared: number = data.prepare?.prepared ?? 0;
      const errors: string[] = data.scan?.errors ?? [];
      const scanError: string | undefined = data.scan?.error;
      const prepError: string | undefined = data.prepare?.error;
      const debugLines: string[] = data.scan?.debug ?? [];

      toast.dismiss(toastId);

      if (scanError || prepError) {
        toast.error(`Scan error: ${scanError ?? prepError}`);
      } else if (errors.length > 0) {
        toast.warning(
          `Fetched ${fetched}, inserted ${inserted}, skipped ${deduped} duplicates (${errors.length} error${errors.length !== 1 ? "s" : ""})`
        );
        console.warn("Scan errors:", errors);
      } else if (fetched === 0) {
        toast.warning(`No jobs returned from job boards. Check Settings → Target Roles.`);
        console.info("Scan debug:", debugLines.join("\n"));
      } else {
        toast.success(
          `Fetched ${fetched} · ${inserted} new · ${deduped} duplicate${deduped !== 1 ? "s" : ""} · prepared ${prepared}`
        );
      }

      router.refresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`Scan failed: ${String(err)}`);
    } finally {
      setScanning(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
      onClick={handleScan}
      disabled={scanning}
    >
      {scanning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Radar className="h-3.5 w-3.5" />
      )}
      {scanning ? "Scanning…" : "Run Scan"}
    </Button>
  );
}
