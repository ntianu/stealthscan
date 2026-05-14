"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotificationsFormProps {
  initialDigestEnabled: boolean;
}

export function NotificationsForm({ initialDigestEnabled }: NotificationsFormProps) {
  const [digestEnabled, setDigestEnabled] = useState(initialDigestEnabled);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setDigestEnabled(checked);
    setSaving(true);
    try {
      const res = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestEnabled: checked }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(checked ? "Digest emails turned on" : "Digest emails turned off");
    } catch {
      // Revert optimistic update
      setDigestEnabled(!checked);
      toast.error("Failed to update preference");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm font-medium">Daily scan digest</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Receive an email after each overnight scan summarising new applications prepared for you.
        </p>
      </div>
      <Switch
        checked={digestEnabled}
        onCheckedChange={handleToggle}
        disabled={saving}
        aria-label="Toggle digest email"
      />
    </div>
  );
}
