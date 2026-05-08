/**
 * Shape passed to the cover letter renderers (HTML, DOCX, PDF).
 */

export interface CoverLetterSender {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
}

export interface CoverLetterRecipient {
  /** Person's name when known (e.g. "Jane Smith, Hiring Manager"). */
  contact?: string;
  /** Company name. */
  company: string;
  /** City/state if known. */
  location?: string;
}

export interface CoverLetterInput {
  sender: CoverLetterSender;
  recipient: CoverLetterRecipient;
  /**
   * Full body text. Paragraphs separated by double newlines (`\n\n`).
   * Single `\n` becomes a soft line break inside a paragraph.
   * If the AI-generated text already includes "Dear …" / "Sincerely,",
   * those land in the body verbatim.
   */
  body: string;
  /** Display date — defaults to today (server timezone). */
  date?: string;
}
