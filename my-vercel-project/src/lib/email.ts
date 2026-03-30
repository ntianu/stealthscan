import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@stealthscan.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stealthscan-git-claude-elastic-wescoff-thentianu.vercel.app";

export interface DigestJob {
  title: string;
  company: string;
  fitScore: number;
}

export interface DigestPayload {
  to: string;
  name: string | null;
  newlyPrepared: number;
  totalInQueue: number;
  topJobs: DigestJob[];
}

function pct(score: number) {
  return `${Math.round(score * 100)}%`;
}

function buildHtml(p: DigestPayload): string {
  const firstName = p.name?.split(" ")[0] ?? "there";
  const jobRows = p.topJobs
    .map(
      (j) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
          <span style="color:#f1f5f9;font-weight:600;">${j.title}</span>
          <span style="color:#94a3b8;"> · ${j.company}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #1e293b;text-align:right;">
          <span style="color:#a78bfa;font-weight:700;">${pct(j.fitScore)}</span>
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#6d28d9;padding:24px 32px;">
            <p style="margin:0;color:#ddd6fe;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Stealth Scan</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Your overnight scan results</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;">Hey ${firstName} — here's what landed in your queue overnight.</p>

            <!-- Stats row -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="50%" style="padding-right:8px;">
                  <div style="background:#0f172a;border-radius:8px;padding:16px;text-align:center;">
                    <p style="margin:0;color:#a78bfa;font-size:32px;font-weight:800;">${p.newlyPrepared}</p>
                    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">prepared tonight</p>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;">
                  <div style="background:#0f172a;border-radius:8px;padding:16px;text-align:center;">
                    <p style="margin:0;color:#f1f5f9;font-size:32px;font-weight:800;">${p.totalInQueue}</p>
                    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">total in queue</p>
                  </div>
                </td>
              </tr>
            </table>

            ${
              p.topJobs.length > 0
                ? `<!-- Top jobs -->
            <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Top matches</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${jobRows}
            </table>`
                : ""
            }

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${APP_URL}/queue"
                     style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
                    Review your queue →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #334155;">
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;">
              Cover letters are pre-generated — you still review and approve each one before anything is sent.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDailyDigest(payload: DigestPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping digest email for", payload.to);
    return;
  }
  if (payload.newlyPrepared === 0 && payload.totalInQueue === 0) {
    // Nothing to report — skip
    return;
  }

  const firstName = payload.name?.split(" ")[0] ?? "there";
  const subject =
    payload.newlyPrepared > 0
      ? `${payload.newlyPrepared} new application${payload.newlyPrepared !== 1 ? "s" : ""} prepped for you overnight`
      : `You have ${payload.totalInQueue} application${payload.totalInQueue !== 1 ? "s" : ""} waiting in your queue`;

  await resend.emails.send({
    from: `Stealth Scan <${FROM}>`,
    to: payload.to,
    subject,
    html: buildHtml(payload),
  });

  console.log(`Digest sent to ${payload.to} (prepared=${payload.newlyPrepared}, queue=${payload.totalInQueue})`);
}
