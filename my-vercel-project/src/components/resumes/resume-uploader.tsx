"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";

const SENIORITY_LEVELS = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const;

export function ResumeUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [roleTags, setRoleTags] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<typeof SENIORITY_LEVELS[number]>("MID");
  const [isDefault, setIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const { startUpload } = useUploadThing("resumeUploader");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!name) setName(f.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Please select a PDF file"); return; }
    if (!name.trim()) { toast.error("Please enter a name for this resume"); return; }

    setUploading(true);
    try {
      const result = await startUpload([file]);
      if (!result?.[0]) throw new Error("Upload failed");

      const { url, key } = result[0] as { url: string; key: string };

      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, fileUrl: url, fileKey: key, roleTags, domains, seniority, isDefault }),
      });
      if (!res.ok) throw new Error(await res.text());

      setUploaded(true);
      toast.success("Resume uploaded successfully");
      setTimeout(() => { router.push("/resumes"); router.refresh(); }, 1200);
    } catch (err) {
      toast.error(`Upload failed: ${String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  if (uploaded) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-green-600">
        <CheckCircle2 className="h-12 w-12" />
        <p className="font-semibold text-lg">Resume uploaded!</p>
        <p className="text-sm text-gray-500">Redirecting to your library…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* File picker */}
      <Card>
        <CardHeader><CardTitle className="text-base">Select PDF</CardTitle></CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
            {file ? (
              <>
                <FileText className="h-10 w-10 text-blue-500" />
                <span className="font-medium text-gray-800">{file.name}</span>
                <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB · Click to change</span>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-400" />
                <span className="font-medium text-gray-600">Click to upload PDF</span>
                <span className="text-xs text-gray-400">Max 4 MB</span>
              </>
            )}
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          </label>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader><CardTitle className="text-base">Resume details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="resume-name">Display name *</Label>
            <Input id="resume-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Engineer — Backend" className="mt-1" />
          </div>

          <div>
            <Label>Seniority level</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SENIORITY_LEVELS.map(s => (
                <button key={s} type="button" onClick={() => setSeniority(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${seniority === s ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-600 hover:border-blue-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Role tags</Label>
            <TagInput value={roleTags} onChange={setRoleTags} placeholder="e.g. backend, data-engineer, product…" className="mt-1" />
            <p className="mt-1 text-xs text-gray-400">Used to match this resume to the right jobs</p>
          </div>

          <div>
            <Label>Domain tags</Label>
            <TagInput value={domains} onChange={setDomains} placeholder="e.g. fintech, saas, healthcare…" className="mt-1" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            <span className="text-sm">Set as default resume (used when no better match is found)</span>
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={uploading || !file}>
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {uploading ? "Uploading…" : "Upload resume"}
        </Button>
      </div>
    </form>
  );
}
