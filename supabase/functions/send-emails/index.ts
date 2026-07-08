// Supabase Edge Function: send-emails
// Handles three modes:
//   mode: "newsletter"           -> send a newsletter to all subscribed users
//   mode: "expiration_reminders" -> email users about coupons expiring in 30/7/1 days
//   mode: "test"                 -> send a single test email
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - injected automatically
//   RESEND_API_KEY - Resend API key
//   MAIL_FROM      - verified sender, e.g. "Coupon Master <noreply@yourdomain.com>"
//
// Deploy: supabase functions deploy send-emails

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') || 'Coupon Master <onboarding@resend.dev>';
  if (!apiKey) return false;
  try {
    const resp = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
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

  const html = nl.custom_html || `<div dir="rtl"><h1>${nl.main_title || nl.title}</h1>${nl.content || ''}</div>`;

  let sent = 0;
  let failed = 0;
  for (const u of (users || []) as any[]) {
    if (optedOut.has(u.id)) continue;
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
      const ok = await sendEmail(body.to, 'מייל בדיקה - Coupon Master', '<div dir="rtl"><p>זהו מייל בדיקה. המערכת עובדת! ✅</p></div>');
      return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: 'שליחה נכשלה (בדוק RESEND_API_KEY)' }, 502);
    }
    return jsonResponse({ error: 'mode לא חוקי' }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
