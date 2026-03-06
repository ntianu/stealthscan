import { Topbar } from "@/components/layout/topbar";
import { ResumeUploader } from "@/components/resumes/resume-uploader";

export default function UploadResumePage() {
  return (
    <>
      <Topbar title="Upload Resume" description="Add a PDF resume to your library" />
      <div className="p-6">
        <p className="mb-6 text-sm text-muted-foreground max-w-2xl">
          Upload a PDF resume and tag it so the bot knows when to use it. You can upload multiple resumes for different role types.
        </p>
        <ResumeUploader />
      </div>
    </>
  );
}
