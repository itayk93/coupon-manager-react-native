// Supabase Edge Function: send-emails
// Handles three modes:
//   mode: "newsletter"           -> send a newsletter to all subscribed users
//   mode: "expiration_reminders" -> email users about coupons expiring in 30/7/1 days
//   mode: "test"                 -> send a single test email
//   mode: "issue_report"         -> send a support report to the admin
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
import { requireAdmin, requireSameUser, requireUser, isServiceRoleCall } from '../_shared/auth.ts';

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

async function handleUpdateSummary(userId: number, updated: number, failed: number, skipped: number) {
  const supabase = supa();
  const { data: user } = await supabase.from('users').select('email, first_name').eq('id', userId).single();
  if (!user?.email) return jsonResponse({ error: 'כתובת אימייל לא נמצאה' }, 404);

  const ok = await sendEmail(
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
  return ok ? jsonResponse({ sent: 1 }) : jsonResponse({ error: 'שליחת המייל נכשלה' }, 502);
}

type MultipassSummaryItem = {
  company: string;
  old_usage: number;
  new_usage: number;
  delta: number;
  value: number;
  remaining_value: number;
};

type MultipassFailureItem = {
  company?: string;
  error: string;
};

function fmtIls(value: number) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return 'לא זמין';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

function renderMultipassDailyHtml(args: {
  firstName: string;
  items: MultipassSummaryItem[];
  successCount: number;
  failureCount: number;
  selectedCount: number;
  skippedCount: number;
  startedAt: string;
  endedAt: string;
  failures: MultipassFailureItem[];
  noChange: boolean;
}) {
  const rows = args.items.map((item) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.company)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${fmtIls(item.old_usage)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${fmtIls(item.new_usage)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#166534;font-weight:700">+${fmtIls(item.delta).replace('₪', '')}₪</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${fmtIls(item.value)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${fmtIls(item.remaining_value)}</td>
    </tr>
  `).join('');

  const failures = args.failures.length
    ? `<div style="margin-top:24px;padding:16px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px">
        <h3 style="margin:0 0 10px 0;color:#9a3412">כשלים / חסמים</h3>
        <ul style="margin:0;padding-right:18px">
          ${args.failures.map((failure) => `<li style="margin-bottom:6px">${escapeHtml(failure.company || 'קופון')} - ${escapeHtml(failure.error)}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const body = args.noChange
    ? `<div style="margin-top:24px;padding:18px;background:#eff6ff;border:1px solid #93c5fd;border-radius:12px">
         <h3 style="margin:0 0 8px 0;color:#1d4ed8">לא זוהה שינוי בשימוש</h3>
         <p style="margin:0;color:#1f2937">נסרקו קופוני Multipass שנבחרו, אבל לא נמצאה עלייה חיובית בשימוש.</p>
       </div>`
    : `<div style="margin-top:24px">
         <h3 style="margin:0 0 12px 0;color:#111827">קופונים עם עלייה בשימוש</h3>
         <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:12px">
           <table style="width:100%;border-collapse:collapse;text-align:right" dir="rtl">
             <thead style="background:#f9fafb">
               <tr>
                 <th style="padding:10px">חברה</th>
                 <th style="padding:10px">שימוש קודם</th>
                 <th style="padding:10px">שימוש חדש</th>
                 <th style="padding:10px">תוספת</th>
                 <th style="padding:10px">ערך</th>
                 <th style="padding:10px">יתרה</th>
               </tr>
             </thead>
             <tbody>${rows}</tbody>
           </table>
         </div>
       </div>`;

  return `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#111827;background:#f8fafc;padding:24px">
    <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e7eb">
      <h2 style="margin-top:0">סיכום עדכון Multipass</h2>
      <p>שלום ${escapeHtml(args.firstName || '')},</p>
      <p>עדכון יומי הסתיים. להלן הסיכום:</p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0">
        <div style="padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb"><strong>${args.selectedCount}</strong><br />נבחרו לסריקה</div>
        <div style="padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb"><strong>${args.successCount}</strong><br />עודכנו בהצלחה</div>
        <div style="padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb"><strong>${args.failureCount}</strong><br />נכשלו</div>
        <div style="padding:14px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb"><strong>${args.skippedCount}</strong><br />דולגו / ללא שינוי</div>
      </div>
      <p style="margin:0 0 6px 0"><strong>שעת התחלה:</strong> ${fmtDateTime(args.startedAt)}</p>
      <p style="margin:0 0 6px 0"><strong>שעת סיום:</strong> ${fmtDateTime(args.endedAt)}</p>
      ${body}
      ${failures}
    </div>
  </div>`;
}

async function handleMultipassDailySummary(body: any) {
  const userId = Number(body.user_id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return jsonResponse({ error: 'user_id חסר או לא תקין' }, 400);
  }

  const supabase = supa();
  const { data: user } = await supabase.from('users').select('email, first_name').eq('id', userId).single();
  if (!user?.email) return jsonResponse({ error: 'כתובת אימייל לא נמצאה' }, 404);

  const items = Array.isArray(body.items) ? body.items as MultipassSummaryItem[] : [];
  const failures = Array.isArray(body.failures) ? body.failures as MultipassFailureItem[] : [];
  const noChange = Boolean(body.no_change);
  const html = renderMultipassDailyHtml({
    firstName: user.first_name || '',
    items,
    successCount: Number(body.success_count || 0),
    failureCount: Number(body.failure_count || 0),
    selectedCount: Number(body.selected_count || 0),
    skippedCount: Number(body.skipped_count || 0),
    startedAt: String(body.started_at || new Date().toISOString()),
    endedAt: String(body.ended_at || new Date().toISOString()),
    failures,
    noChange,
  });

  const subject = noChange
    ? 'סיכום עדכון Multipass: ללא שינוי'
    : 'סיכום עדכון Multipass: זוהה שימוש חדש';

  const ok = await sendEmail(user.email, subject, html);
  return ok ? jsonResponse({ sent: 1 }) : jsonResponse({ error: 'שליחת המייל נכשלה' }, 502);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = body.mode;

    // This function cannot sit behind gateway JWT verification, because
    // issue_report is reached from /issues, a public route. So authorisation is
    // per-mode: everything that sends mail to anyone other than the site owner
    // requires an admin, or the service role for the cron-driven run.
    const ADMIN_MODES = ['newsletter', 'expiration_reminders', 'test'];
    if (ADMIN_MODES.includes(mode) && !isServiceRoleCall(req)) {
      try {
        await requireAdmin(req);
      } catch {
        return jsonResponse({ error: 'אין הרשאה' }, 403);
      }
    }

    if (mode === 'newsletter') return await handleNewsletter(body.newsletter_id);
    if (mode === 'expiration_reminders') return await handleExpirationReminders();
    if (mode === 'multipass_update_summary') {
      if (isServiceRoleCall(req)) {
        return await handleUpdateSummary(
          Number(body.user_id),
          Number(body.updated || 0),
          Number(body.failed || 0),
          Number(body.skipped || 0),
        );
      }

      const user = await requireUser(req);
      requireSameUser(body.user_id, user.id);
      return await handleUpdateSummary(user.id, Number(body.updated || 0), Number(body.failed || 0), Number(body.skipped || 0));
    }
    if (mode === 'multipass_daily_summary') {
      if (!isServiceRoleCall(req)) {
        return jsonResponse({ error: 'אין הרשאה' }, 403);
      }
      return await handleMultipassDailySummary(body);
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
