import { config } from '../../config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Console provider (default): prints the full message — including any
 * verification/reset link — to the backend terminal, so every auth flow is
 * testable in dev without an email account.
 */
async function sendViaConsole(msg: EmailMessage): Promise<void> {
  console.log(
    [
      '',
      '═══════════════ EMAIL (console mode — set RESEND_API_KEY to send for real) ═══════════════',
      `To:      ${msg.to}`,
      `Subject: ${msg.subject}`,
      '',
      msg.text,
      '════════════════════════════════════════════════════════════════════════════════════════',
      '',
    ].join('\n')
  );
}

/** Resend (resend.dev) — free tier: 100 emails/day, no card. */
async function sendViaResend(msg: EmailMessage): Promise<void> {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.emailFrom, to: [msg.to], subject: msg.subject, text: msg.text }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Resend ${resp.status}: ${body.slice(0, 300)}`);
  }
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (config.resendApiKey) return sendViaResend(msg);
  return sendViaConsole(msg);
}
