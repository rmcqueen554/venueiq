import axios from 'axios';
import { logger } from './logger';

const POSTMARK_BASE = 'https://api.postmarkapp.com';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html_body: string;
  text_body?: string;
  tag?: string;
  reply_to?: string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const apiToken = process.env.POSTMARK_API_TOKEN;
  if (!apiToken) {
    logger.warn('POSTMARK_API_TOKEN not set — skipping email send');
    return;
  }

  const recipients = Array.isArray(opts.to) ? opts.to.join(',') : opts.to;

  await axios.post(
    `${POSTMARK_BASE}/email`,
    {
      From: `${process.env.EMAIL_FROM_NAME ?? 'VenueIQ'} <${process.env.EMAIL_FROM_ADDRESS ?? 'noreply@venueiq.com'}>`,
      To: recipients,
      Subject: opts.subject,
      HtmlBody: opts.html_body,
      TextBody: opts.text_body ?? opts.subject,
      MessageStream: 'outbound',
      Tag: opts.tag ?? 'venueiq',
      ...(opts.reply_to ? { ReplyTo: opts.reply_to } : {}),
    },
    {
      headers: {
        'X-Postmark-Server-Token': apiToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 10000,
    },
  );

  logger.info({ to: recipients, subject: opts.subject }, 'Email sent via Postmark');
}

export function buildBriefingEmail(briefing: string, venueName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0A0B0E;color:#FFFFFF;font-family:'DM Sans',Arial,sans-serif;margin:0;padding:0">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px">
    <div style="margin-bottom:24px">
      <span style="color:#E8A838;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">VENUEIQ — DAILY BRIEFING</span>
      <h1 style="color:#FFFFFF;font-size:24px;margin:8px 0;font-family:Georgia,serif">${venueName}</h1>
      <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div style="background:#0F1116;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:24px;margin-bottom:24px">
      <div style="font-size:15px;line-height:1.7;color:rgba(255,255,255,0.9);white-space:pre-wrap">${briefing}</div>
    </div>
    <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.07)">
      <p style="color:rgba(255,255,255,0.3);font-size:11px">VenueIQ by Augmentation Consulting Group · <a href="#" style="color:#E8A838">View Dashboard</a></p>
    </div>
  </div>
</body>
</html>`;
}
