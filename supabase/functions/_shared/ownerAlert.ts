// Emails the owner when the OpenAI quota runs out, so it is topped up before
// users notice. Throttled to one mail per hour per isolate to avoid a flood.
//
// Env vars: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME,
// OWNER_ALERT_EMAIL (optional, defaults to the owner address below).

import { safeFetch } from './ssrf.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_OWNER_EMAIL = 'itayk93@gmail.com';
const THROTTLE_MS = 60 * 60 * 1000;

let lastSentAt = 0;

export function isQuotaExhausted(status: number, rawText: string | null | undefined): boolean {
  return status === 429 && /insufficient_quota/.test(rawText ?? '');
}

export async function alertOwnerQuotaExhausted(source: string): Promise<void> {
  const now = Date.now();
  if (now - lastSentAt < THROTTLE_MS) return;
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    console.error('[ownerAlert] BREVO_API_KEY missing, cannot send quota alert');
    return;
  }
  lastSentAt = now;
  try {
    const response = await safeFetch(BREVO_API_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: {
          email: Deno.env.get('BREVO_SENDER_EMAIL') || 'no-reply@couponmaster.app',
          name: Deno.env.get('BREVO_SENDER_NAME') || 'קופון מאסטר',
        },
        to: [{ email: Deno.env.get('OWNER_ALERT_EMAIL') || DEFAULT_OWNER_EMAIL }],
        subject: 'התראה: נגמרה המכסה ב-OpenAI',
        htmlContent:
          `<div dir="rtl"><p>המכסה בחשבון OpenAI נגמרה (<code>insufficient_quota</code>) והזיהוי החכם של הקופונים לא עובד.</p>` +
          `<p>מקור: ${source}</p>` +
          `<p>יש להטעין קרדיט: https://platform.openai.com/settings/organization/billing</p></div>`,
      }),
    });
    if (!response.ok) {
      lastSentAt = 0;
      console.error('[ownerAlert] brevo error:', response.status, await response.text());
    }
  } catch (err) {
    lastSentAt = 0;
    console.error('[ownerAlert] email failed:', err);
  }
}
