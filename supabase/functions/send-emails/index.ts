// Supabase Edge Function: send-emails
// Handles these modes:
//   mode: "newsletter"           -> send a newsletter to all subscribed users
//   mode: "test"                 -> send a single test email
//   mode: "issue_report"         -> send a support report to the admin
//
// Expiry reminders moved to send-expiry-alerts (email + push + in-app).
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - injected automatically
//   BREVO_API_KEY       - Brevo transactional email API key
//   BREVO_SENDER_EMAIL  - authenticated sender address
//   BREVO_SENDER_NAME   - sender display name
//
// Deploy: supabase functions deploy send-emails

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireAdmin, requireSameUser, requireUser, isServiceRoleCall, isAdminIpAllowed } from '../_shared/auth.ts';
import { buildUnsubscribeUrl, buildUnsubscribeHeaders } from '../_shared/unsubscribe.ts';
import { safeFetch } from '../_shared/ssrf.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

type EmailResult = { ok: boolean; error?: string };

async function sendEmailDetailed(
  to: string,
  subject: string,
  html: string,
  /** RFC 8058 headers; set for bulk mail, omitted for one-off transactional. */
  headers: Record<string, string> = {},
): Promise<EmailResult> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'hello@itaykarkason.com';
  const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Coupon Master';
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY missing' };
  try {
    const resp = await safeFetch(BREVO_API_URL, {
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
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      }),
    });
    if (resp.ok) return { ok: true };
    return { ok: false, error: `Brevo ${resp.status}: ${(await resp.text()).slice(0, 500)}` };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers: Record<string, string> = {},
): Promise<boolean> {
  return (await sendEmailDetailed(to, subject, html, headers)).ok;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] || char);
}

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function isMultipassCronRequest(req: Request): boolean {
  const presented = req.headers.get('x-cron-token') || '';
  const expected = Deno.env.get('MULTIPASS_CRON_TOKEN') || '';
  if (!presented || !expected || presented.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < presented.length; i += 1) {
    mismatch |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

async function wrapMarketingEmail(html: string, userPublicId: string, email: string) {
  const unsubscribeUrl = await buildUnsubscribeUrl(userPublicId, email);
  if (!unsubscribeUrl) return html;

  return `${html}
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb" />
  <div dir="rtl" style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.6">
    <p>אם אינך רוצה לקבל דיוור שיווקי, אפשר <a href="${unsubscribeUrl}">להסיר את עצמך כאן</a>.</p>
  </div>`;
}

async function handleNewsletter(newsletterId: number) {
  const supabase = supa();
  const { data: nl } = await supabase
    .from('newsletters')
    .select('id,title,content,main_title,custom_html,is_sent,sent_count,is_published')
    .eq('id', newsletterId)
    .single();
  if (!nl) return jsonResponse({ error: 'ניוזלטר לא נמצא' }, 404);

  // Subscribers who have not opted out
  const { data: users } = await supabase
    .from('users')
    .select('id, public_id, email, first_name')
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
      u.public_id,
      u.email,
    );
    const ok = await sendEmail(u.email, nl.title, html, await buildUnsubscribeHeaders(u.public_id, u.email));
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

async function handleUpdateSummary(userId: number, updated: number, failed: number, skipped: number) {
  const supabase = supa();
  const { data: user } = await supabase.from('users').select('email, first_name').eq('id', userId).single();
  if (!user?.email) return jsonResponse({ error: 'כתובת אימייל לא נמצאה' }, 404);

  const result = await sendEmailDetailed(
    user.email,
    'עדכון יתרות הקופונים הסתיים',
    `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
      <h2>עדכון יתרות הסתיים</h2>
      <p>שלום ${escapeHtml(user.first_name || '')},</p>
      <p>עודכנו: <strong>${updated}</strong></p>
      <p>נכשלו: <strong>${failed}</strong></p>
      <p>דולגו: <strong>${skipped}</strong></p>
      <p><a href="https://coupons.itaykarkason.com/coupons">לצפייה בקופונים</a></p>
    </div>`,
  );
  return result.ok
    ? jsonResponse({ sent: 1 })
    : jsonResponse({ error: 'שליחת המייל נכשלה', detail: result.error }, 502);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    const body = await req.json();
    const mode = body.mode;

    // This function cannot sit behind gateway JWT verification, because
    // issue_report is reached from /issues, a public route. So authorisation is
    // per-mode: everything that sends mail to anyone other than the site owner
    // requires an admin, or the service role for the cron-driven run.
    const ADMIN_MODES = ['newsletter', 'test'];
    if (ADMIN_MODES.includes(mode) && !isServiceRoleCall(req)) {
      if (!isAdminIpAllowed(req)) {
        return jsonResponse({ error: 'הגישה נדחתה מכתובת הרשת הזו' }, 403);
      }
      try {
        await requireAdmin(req);
      } catch {
        return jsonResponse({ error: 'אין הרשאה' }, 403);
      }
    }

    if (mode === 'newsletter') return await handleNewsletter(body.newsletter_id);
    if (mode === 'multipass_update_summary') {
      if (isServiceRoleCall(req) || isMultipassCronRequest(req)) {
        return await handleUpdateSummary(
          Number(body.user_id),
          Number(body.updated || 0),
          Number(body.failed || 0),
          Number(body.skipped || 0),
        );
      }

      const user = await requireUser(req);
      requireSameUser(body.user_id, user);
      return await handleUpdateSummary(user.id, Number(body.updated || 0), Number(body.failed || 0), Number(body.skipped || 0));
    }
    if (mode === 'test') {
      const ok = await sendEmail(
        body.to,
        'מייל בדיקה - Coupon Master',
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6"><h2>Coupon Master מחובר למייל</h2><p>זהו מייל בדיקה. שירות Brevo עובד בהצלחה.</p></div>',
      );
      return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: 'שליחה נכשלה דרך Brevo' }, 502);
    }
    if (mode === 'issue_report') {
      const subject = String(body.subject || '').trim().slice(0, 160);
      const details = String(body.details || '').trim().slice(0, 8000);
      const reporterEmail = String(body.email || '').trim().slice(0, 254);
      if (!subject || !details) return jsonResponse({ error: 'חסרים נושא ופרטי תקלה' }, 400);

      const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
        <h2>דיווח תקלה חדש - Coupon Master</h2>
        <p><strong>נושא:</strong> ${escapeHtml(subject)}</p>
        <p><strong>פרטים:</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(details)}</p>
        <p><strong>אימייל לחזרה:</strong> ${escapeHtml(reporterEmail || 'לא צוין')}</p>
        <p><strong>עמוד:</strong> ${escapeHtml(String(body.page_url || 'לא צוין'))}</p>
      </div>`;
      const ok = await sendEmail(
        'itayk93@gmail.com',
        `דיווח תקלה: ${subject}`,
        html,
      );
      return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: 'שליחת הדיווח נכשלה' }, 502);
    }
    return jsonResponse({ error: 'mode לא חוקי' }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
