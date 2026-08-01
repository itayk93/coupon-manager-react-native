// Supabase Edge Function: send-emails
// Handles three modes:
//   mode: "newsletter"           -> send a newsletter to all subscribed users
//   mode: "expiration_reminders" -> email users about coupons expiring in 30/7/1 days
//   mode: "test"                 -> send a single test email
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - injected automatically
//   BREVO_API_KEY       - Brevo transactional email API key
//   BREVO_SENDER_EMAIL  - authenticated sender address
//   BREVO_SENDER_NAME   - sender display name
//
// Deploy: supabase functions deploy send-emails

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const textEncoder = new TextEncoder();

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'hello@itaykarkason.com';
  const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Coupon Master';
  if (!apiKey) return false;
  try {
    const resp = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function createUnsubscribeToken(userId: number, email: string) {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) return null;
  const payload = JSON.stringify({ user_id: userId, email, type: 'unsubscribe' });
  const payloadPart = toBase64Url(textEncoder.encode(payload));
  const signaturePart = await signPayload(payload, secret);
  return `${payloadPart}.${signaturePart}`;
}

async function buildUnsubscribeUrl(userId: number, email: string) {
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  if (!appBaseUrl) return null;
  const token = await createUnsubscribeToken(userId, email);
  if (!token) return null;
  const normalizedBase = appBaseUrl.replace(/\/$/, '');
  return `${normalizedBase}/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function wrapMarketingEmail(html: string, userId: number, email: string) {
  const unsubscribeUrl = await buildUnsubscribeUrl(userId, email);
  if (!unsubscribeUrl) return html;

  return `${html}
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb" />
  <div dir="rtl" style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.6">
    <p>אם אינך רוצה לקבל דיוור שיווקי, אפשר <a href="${unsubscribeUrl}">להסיר את עצמך כאן</a>.</p>
  </div>`;
}

async function handleNewsletter(newsletterId: number) {
  const supabase = supa();
  const { data: nl } = await supabase.from('newsletters').select('*').eq('id', newsletterId).single();
  if (!nl) return jsonResponse({ error: 'ניוזלטר לא נמצא' }, 404);

  // Subscribers who have not opted out
  const { data: users } = await supabase
    .from('users')
    .select('id, email, first_name')
    .eq('newsletter_subscription', true)
    .eq('is_deleted', false);

  const { data: optOuts } = await supabase.from('opt_outs').select('user_id').eq('opted_out', true);
  const optedOut = new Set((optOuts || []).map((o: any) => o.user_id));

  let sent = 0;
  let failed = 0;
  for (const u of (users || []) as any[]) {
    if (optedOut.has(u.id)) continue;
    const html = await wrapMarketingEmail(
      nl.custom_html || `<div dir="rtl"><h1>${nl.main_title || nl.title}</h1>${nl.content || ''}</div>`,
      u.id,
      u.email,
    );
    const ok = await sendEmail(u.email, nl.title, html);
    await supabase.from('newsletter_sendings').insert({
      newsletter_id: newsletterId,
      user_id: u.id,
      sent_at: new Date().toISOString(),
      delivery_status: ok ? 'sent' : 'failed',
    });
    if (ok) sent++;
    else failed++;
  }

  await supabase
    .from('newsletters')
    .update({ is_sent: true, sent_count: sent, is_published: true })
    .eq('id', newsletterId);

  return jsonResponse({ sent, failed });
}

async function handleExpirationReminders() {
  const supabase = supa();
  const now = new Date();
  const windows = [
    { days: 30, flag: 'reminder_sent_30_days' },
    { days: 7, flag: 'reminder_sent_7_days' },
    { days: 1, flag: 'reminder_sent_1_day' },
  ];

  let sent = 0;
  for (const w of windows) {
    const target = new Date(now.getTime() + w.days * 86400000);
    const dayStart = new Date(target); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target); dayEnd.setHours(23, 59, 59, 999);

    const { data: coupons } = await supabase
      .from('coupon')
      .select('id, company, value, used_value, expiration, user_id, ' + w.flag)
      .eq('status', 'פעיל')
      .eq(w.flag, false)
      .gte('expiration', dayStart.toISOString())
      .lte('expiration', dayEnd.toISOString());

    for (const c of (coupons || []) as any[]) {
      const { data: user } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', c.user_id)
        .single();
      if (!user?.email) continue;

      const remaining = (c.value - c.used_value).toFixed(2);
      const html = `<div dir="rtl">
        <h2>שלום ${user.first_name || ''},</h2>
        <p>הקופון שלך מחברת <strong>${c.company}</strong> עומד לפוג בעוד ${w.days} ימים.</p>
        <p>יתרה נותרת: <strong>${remaining} ₪</strong></p>
        <p>מומלץ לנצל אותו בזמן!</p>
      </div>`;
      const ok = await sendEmail(user.email, `תזכורת: קופון ${c.company} עומד לפוג`, html);
      if (ok) {
        await supabase.from('coupon').update({ [w.flag]: true }).eq('id', c.id);
        sent++;
      }
    }
  }

  return jsonResponse({ sent });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = body.mode;

    if (mode === 'newsletter') return await handleNewsletter(body.newsletter_id);
    if (mode === 'expiration_reminders') return await handleExpirationReminders();
    if (mode === 'test') {
      const ok = await sendEmail(
        body.to,
        'מייל בדיקה - Coupon Master',
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6"><h2>Coupon Master מחובר למייל</h2><p>זהו מייל בדיקה. שירות Brevo עובד בהצלחה.</p></div>',
      );
      return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: 'שליחה נכשלה דרך Brevo' }, 502);
    }
    return jsonResponse({ error: 'mode לא חוקי' }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
