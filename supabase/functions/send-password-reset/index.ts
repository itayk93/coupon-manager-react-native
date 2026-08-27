// Supabase Edge Function: send-password-reset
//
// Sends the "pick a new password" email through Brevo, the same way every
// other mail this project sends goes out.
//
// Why this exists rather than a plain resetPasswordForEmail() from the app:
// Supabase Auth's own mailer is the built-in shared SMTP, and its quota is a
// couple of messages an hour for the whole project. A user who mistypes their
// address twice burns it for everyone, and the next person to ask for a reset
// gets "email rate limit exceeded" instead of a link. Brevo is already wired
// up for expiry alerts and newsletters, so the link is generated here with the
// admin API and delivered on the channel that actually has a quota.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected automatically),
// BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { messageEmailHtml } from '../_shared/emailTemplate.ts';
import { safeFetch } from '../_shared/ssrf.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/** Where the link lands. Only these may be handed to Supabase as redirect_to. */
const ALLOWED_REDIRECTS = [
  'https://coupons.itaykarkason.com/reset-password',
  'http://localhost:8081/reset-password',
];

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value) && value.length <= 254;
}

/**
 * An open redirect here would be a working phishing link signed by us: the mail
 * comes from our domain and hands the recovery token to whatever host asked.
 * So the client states where it wants to land and we accept it only if we
 * already know the place.
 */
function safeRedirect(value: unknown): string {
  return typeof value === 'string' && ALLOWED_REDIRECTS.includes(value)
    ? value
    : ALLOWED_REDIRECTS[0];
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    console.error('[send-password-reset] BREVO_API_KEY missing');
    return false;
  }
  try {
    const response = await safeFetch(BREVO_API_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: {
          email: Deno.env.get('BREVO_SENDER_EMAIL') || 'no-reply@couponmaster.app',
          name: Deno.env.get('BREVO_SENDER_NAME') || 'קופון מאסטר',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!response.ok) {
      console.error('[send-password-reset] brevo error:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[send-password-reset] email failed:', err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    if (!isEmail(email)) return jsonResponse({ error: 'INVALID_EMAIL' }, 400);
    const redirectTo = safeRedirect(body?.redirectTo);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Every answer below this line is the same one. Whether the address has an
    // account is not something a stranger gets to learn by asking here.
    const ok = jsonResponse({ sent: true });

    const { data: profile } = await supabase
      .from('users')
      .select('first_name')
      .ilike('email', email)
      .maybeSingle();

    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (linkError || !link?.properties?.action_link) {
      // Unknown address, or Auth refused because the last link is still warm.
      // Neither is the caller's business, and neither is worth a retry.
      console.warn('[send-password-reset] no link for request:', linkError?.message);
      return ok;
    }

    const sent = await sendViaBrevo(
      email,
      'שחזור סיסמה — קופון מאסטר',
      messageEmailHtml({
        firstName: profile?.first_name || '',
        title: 'שחזור סיסמה',
        body: 'קיבלנו בקשה לאיפוס הסיסמה שלך. הקישור תקף לשעה אחת, ואם לא ביקשת אותו אפשר להתעלם מהמייל הזה — הסיסמה הנוכחית תישאר כפי שהיא.',
        ctaLabel: 'בחירת סיסמה חדשה',
        appUrl: link.properties.action_link,
        unsubscribeUrl: null,
      }),
    );
    if (!sent) return jsonResponse({ error: 'EMAIL_FAILED' }, 502);

    return ok;
  } catch (err) {
    console.error('[send-password-reset] fatal:', err);
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
  }
});
