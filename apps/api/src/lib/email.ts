import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SmartHirink <noreply@smarthirink.com>';

interface InviteEmailParams {
  candidateEmail: string;
  candidateName: string;
  interviewUrl: string;
  scenarioTitle: string;
  position: string;
  scheduledAt?: Date | null;
}

export async function sendInterviewInvite(params: InviteEmailParams) {
  const { candidateEmail, candidateName, interviewUrl, scenarioTitle, position, scheduledAt } = params;

  const scheduledLine = scheduledAt
    ? `<p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Scheduled:</strong> ${new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">SmartHirink</h1>
    </div>

    <!-- Content -->
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">You're Invited to an Interview</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
        Hi ${candidateName},<br><br>
        You have been invited to a virtual AI-powered interview. Click the button below to join when you're ready.
      </p>

      <!-- Interview Details -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Position:</strong> ${position}</p>
        <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Scenario:</strong> ${scenarioTitle}</p>
        ${scheduledLine}
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${interviewUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
          Join Interview
        </a>
      </div>

      <!-- Checklist -->
      <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
        <p style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:600;">Before you begin:</p>
        <ul style="margin:0;padding:0 0 0 20px;color:#6b7280;font-size:13px;line-height:2;">
          <li>Ensure your microphone is working</li>
          <li>Use a stable internet connection</li>
          <li>Find a quiet environment</li>
          <li>Be ready to respond in English</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        This interview is conducted by an AI interviewer. The session is recorded and automatically transcribed. Evaluation results are advisory only.
      </p>
    </div>
  </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: candidateEmail,
    subject: `Interview Invitation: ${position} - ${scenarioTitle}`,
    html,
  });

  if (error) {
    throw new Error(`Failed to send invite email: ${error.message}`);
  }

  return data;
}
