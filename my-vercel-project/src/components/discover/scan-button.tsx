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

      const inserted: number = data.scan?.inserted ?? 0;
      const prepared: number = data.prepare?.prepared ?? 0;
      const errors: string[] = data.scan?.errors ?? [];

      toast.dismiss(toastId);

      if (errors.length > 0) {
        toast.warning(`Scan finished with warnings: ${errors[0]}`);
      } else {
        toast.success(
          `Found ${inserted} new job${inserted !== 1 ? "s" : ""}, prepared ${prepared} application${prepared !== 1 ? "s" : ""}`
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
