"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResumeActionsProps {
  id: string;
  isDefault: boolean;
}

export function ResumeActions({ id, isDefault }: ResumeActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this resume? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Resume removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove resume");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetDefault() {
    setSettingDefault(true);
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Default resume updated");
      router.refresh();
    } catch {
      toast.error("Failed to update default");
    } finally {
      setSettingDefault(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {!isDefault && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
          onClick={handleSetDefault}
          disabled={settingDefault}
          title="Set as default"
        >
          <Star className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
        onClick={handleDelete}
        disabled={deleting}
        title="Remove resume"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
