import { Application, Job, Resume } from "@prisma/client";

export interface ApplyKit {
  jobUrl: string;
  resumeUrl: string;
  coverLetter: string;
  answers: Record<string, string>;
  instructions: string[];
}

/**
 * Build a ready-to-use "Apply Kit" for platforms that don't support API submission.
 * The user opens the apply URL and uses the kit to fill in the form manually.
 */
export function buildApplyKit(
  application: Application & { job: Job; resume: Resume | null }
): ApplyKit {
  const customAnswers = (application.customAnswers as Record<string, string>) ?? {};

  const instructions = [
    `1. Open the job application at: ${application.job.applyUrl}`,
    "2. Upload your resume using the download link below.",
    "3. Copy and paste the cover letter into the cover letter field.",
    "4. Use the pre-filled answers for the standard questions.",
    "5. Review everything, then click Submit.",
  ];

  return {
    jobUrl: application.job.applyUrl,
    resumeUrl: application.resume?.fileUrl ?? "",
    coverLetter: application.coverLetter ?? "",
    answers: customAnswers,
    instructions,
  };
}

/**
 * Submit to Greenhouse via their apply API.
 */
export async function submitToGreenhouse(params: {
  jobId: string; // Greenhouse job ID
  companySlug: string;
  firstName: string;
  lastName: string;
  email: string;
  resumeUrl: string; // publicly accessible URL
  coverLetter?: string;
  answers?: Record<string, string>;
}): Promise<{ success: boolean; confirmationId?: string; error?: string }> {
  const { jobId, companySlug, firstName, lastName, email, resumeUrl, coverLetter, answers } = params;

  const submitUrl = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs/${jobId}/applications`;

  try {
    const body: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      email,
      resume_url: resumeUrl,
    };

    if (coverLetter) {
      body.cover_letter_text = coverLetter;
    }

    if (answers && Object.keys(answers).length > 0) {
      body.answers = Object.entries(answers).map(([question, value]) => ({
        question,
        answer: value,
      }));
    }

    const res = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Greenhouse API error: ${res.status} ${errorText}` };
    }

    const data = await res.json();
    return { success: true, confirmationId: String(data.id ?? "") };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Submit to Lever via their apply API.
 */
export async function submitToLever(params: {
  postingId: string;
  companySlug: string;
  name: string;
  email: string;
  resumeUrl: string;
  coverLetter?: string;
}): Promise<{ success: boolean; confirmationId?: string; error?: string }> {
  const { postingId, companySlug, name, email, resumeUrl, coverLetter } = params;

  const submitUrl = `https://api.lever.co/v0/postings/${companySlug}/${postingId}/apply`;

  try {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("resume_url", resumeUrl);
    if (coverLetter) formData.append("comments", coverLetter);

    const res = await fetch(submitUrl, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Lever API error: ${res.status} ${errorText}` };
    }

    const data = await res.json();
    return { success: true, confirmationId: String(data.applicationId ?? "") };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
