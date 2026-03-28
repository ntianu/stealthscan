"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "PREPARED",    label: "Prepared",    color: "text-amber-400" },
  { value: "APPROVED",    label: "Approved",    color: "text-blue-400" },
  { value: "SUBMITTED",   label: "Submitted",   color: "text-emerald-400" },
  { value: "INTERVIEWING",label: "Interviewing",color: "text-purple-400" },
  { value: "OFFER",       label: "Offer",       color: "text-green-400" },
  { value: "RESPONDED",   label: "Responded",   color: "text-violet-400" },
  { value: "REJECTED",    label: "Rejected / Skipped", color: "text-muted-foreground" },
];

interface TrackingPanelProps {
  applicationId: string;
  initialStatus: string;
  initialNotes: string | null;
  initialInterviewDate: string | null; // ISO string or null
}

export function TrackingPanel({
  applicationId,
  initialStatus,
  initialNotes,
  initialInterviewDate,
}: TrackingPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [interviewDate, setInterviewDate] = useState(
    initialInterviewDate ? new Date(initialInterviewDate).toISOString().slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes: notes || null,
          interviewDate: interviewDate ? new Date(interviewDate).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Tracking updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  <span className={s.color}>{s.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Interview date / time</Label>
          <input
            type="datetime-local"
            value={interviewDate}
            onChange={(e) => setInterviewDate(e.target.value)}
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes, contacts, follow-up reminders…"
          className="text-xs min-h-[80px] resize-y"
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save tracking
        </Button>
      </div>
    </div>
  );
}
