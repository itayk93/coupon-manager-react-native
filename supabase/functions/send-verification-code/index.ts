// Supabase Edge Function: send-verification-code
//
// Signing up is a typed six-digit code rather than a link in a mail we did not
// write. Auth still owns the code — generateLink() mints one and returns it in
// properties.email_otp without posting anything — so the app confirms with a
// plain verifyOtp() and Auth remains the only thing that decides whether a code
// is good. What this function takes over is the delivery: the mail is ours, on
// our template, from our domain, through Brevo, the same channel as every other
// message this project sends. Same reason as send-password-reset: the built-in
// SMTP allows a couple of messages an hour for the whole project.
//
// Modes:
//   mode: "signup" -> creates the (unconfirmed) auth user and mails the code
//   mode: "resend" -> mails a fresh code to an account that has not confirmed
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected automatically),
// BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME.
//
// Deploy: supabase functions deploy send-verification-code

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { messageEmailHtml } from '../_shared/emailTemplate.ts';
import { safeFetch } from '../_shared/ssrf.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value) && value.length <= 254;
}

function name(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    console.error('[send-verification-code] BREVO_API_KEY missing');
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
      console.error('[send-verification-code] brevo error:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[send-verification-code] email failed:', err);
    return false;
  }
}

function codeEmailHtml(firstName: string, code: string): string {
  return messageEmailHtml({
    firstName,
    title: 'קוד האימות שלך',
    highlight: code,
    body:
      'הקוד תקף לשעה אחת. מקלידים אותו במסך האימות באפליקציה והחשבון נפתח. ' +
      'אם לא ביקשת להירשם, אפשר להתעלם מהמייל הזה ולא ייפתח שום חשבון.',
    ctaLabel: null,
    appUrl: null,
    unsubscribeUrl: null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    if (!isEmail(email)) return jsonResponse({ error: 'INVALID_EMAIL' }, 400);
    const mode = body?.mode === 'resend' ? 'resend' : 'signup';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const firstName = name(body?.firstName);
    const newsletterSubscription = body?.newsletterSubscription === true;
    const marketingConsentAt = newsletterSubscription ? new Date().toISOString() : null;
    let otp: string | undefined;

    if (mode === 'signup') {
      const password = typeof body?.password === 'string' ? body.password : '';
      if (password.length < 6) return jsonResponse({ error: 'INVALID_PASSWORD' }, 400);

      // Creates the user unconfirmed and hands back the code. An address that
      // already has a confirmed account is refused here, which is the same
      // answer signUp() used to give the register screen.
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: name(body?.lastName),
            newsletter_subscription: newsletterSubscription,
            marketing_consent_at: marketingConsentAt,
          },
        },
      });

      if (error) {
        const already = /already|exists|registered/i.test(error.message || '');
        console.warn('[send-verification-code] signup link failed:', error.message);
        return jsonResponse({ error: already ? 'EMAIL_TAKEN' : 'LINK_FAILED' }, already ? 409 : 502);
      }
      otp = data?.properties?.email_otp;
    } else {
      // Resend has no password to offer, so the code is minted as a magic link
      // instead. Verifying one confirms the address just the same, and the app
      // checks it with type "email" rather than "signup".
      const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });

      // Whether the address has an account is not something a stranger gets to
      // learn by asking for a resend.
      if (error) {
        console.warn('[send-verification-code] resend link failed:', error.message);
        return jsonResponse({ sent: true });
      }
      otp = data?.properties?.email_otp;
    }

    if (!otp) return jsonResponse({ error: 'LINK_FAILED' }, 502);

    const { data: profile } = await supabase
      .from('users')
      .select('first_name')
      .ilike('email', email)
      .maybeSingle();

    const sent = await sendViaBrevo(
      email,
      `${otp} — קוד האימות שלך בקופון מאסטר`,
      codeEmailHtml(firstName || profile?.first_name || '', otp),
    );
    if (!sent) return jsonResponse({ error: 'EMAIL_FAILED' }, 502);

    return jsonResponse({ sent: true });
  } catch (err) {
    console.error('[send-verification-code] fatal:', err);
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500);
  }
});
