// Supabase Edge Function: send-expiry-alerts
//
// The single driver for expiry reminders across all three channels: email
// (Brevo), push (Web Push + Expo), and in-app (the notifications table).
//
// Invoked hourly by pg_cron through public.trigger_send_expiry_alerts(), which
// passes the service-role key. Hourly rather than daily so a per-user "not
// before this hour" preference delays an alert instead of dropping it; the
// coupon_alerts ledger is what keeps the extra runs from sending twice.
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  - injected automatically
//   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME - email delivery
//   UNSUBSCRIBE_SECRET - signs the unsubscribe link in the footer
//   EXPIRY_CRON_TOKEN  - shared with the pg_cron job (see migration 0020)
//   APP_BASE_URL       - base for the unsubscribe link
//   SSRF_ALLOWED_HOSTS must include api.brevo.com and exp.host

import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { isServiceRoleCall, requireAdmin } from '../_shared/auth.ts';
import { safeFetch } from '../_shared/ssrf.ts';
import { buildUnsubscribeUrl, buildUnsubscribeHeaders } from '../_shared/unsubscribe.ts';
import { expiryEmailHtml } from '../_shared/emailTemplate.ts';
import { createServiceClient, sendPushToRows, type PushSubscriptionRow } from '../_shared/push.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_WINDOWS = [30, 7, 1, 0];
const ACTIVE_STATUS = 'פעיל';
const DEFAULT_TIMEZONE = 'Asia/Jerusalem';
/** Users who set no quiet_until are not woken before this local hour. */
const DEFAULT_SEND_HOUR = 9;
const CHANNELS = ['email', 'push', 'in_app'] as const;

type Channel = typeof CHANNELS[number];

type PreferenceRow = {
  user_id: number;
  email: boolean;
  push: boolean;
  in_app: boolean;
  windows: number[] | null;
  quiet_until: string | null;
  timezone: string | null;
  /** Remind every day once a coupon is this close to expiry. null = off. */
  daily_within: number | null;
};

type UserRow = { id: number; email: string; first_name: string | null };

type CouponRow = {
  id: number;
  user_id: number;
  company: string;
  value: number;
  used_value: number;
  expiration: string;
};

type LedgerRow = {
  coupon_id: number;
  user_id: number;
  window_days: number;
  channel: Channel;
  status: 'sent' | 'failed';
};

/**
 * pg_cron has no JWT to present, so it carries a token that authorises exactly
 * one action: starting a run. Compared in constant time.
 */
function isCronCall(req: Request): boolean {
  const expected = Deno.env.get('EXPIRY_CRON_TOKEN');
  const presented = req.headers.get('x-cron-token');
  if (!expected || !presented || expected.length !== presented.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return diff === 0;
}

/** Calendar date (YYYY-MM-DD) as it reads right now in the given zone. */
function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/**
 * Add days to a YYYY-MM-DD string as pure calendar arithmetic. Deliberately
 * reads the UTC parts back out: the input is already a local calendar date, so
 * re-projecting it through a zone would shift it by a day wherever the offset
 * is negative.
 */
function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function localHourInTimeZone(timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: 'numeric', hour12: false,
  }).format(new Date()));
}

/** The earliest local hour this user may be contacted. */
function sendHour(quietUntil: string | null): number {
  if (!quietUntil) return DEFAULT_SEND_HOUR;
  const match = quietUntil.match(/^(\d{1,2}):/);
  return match ? Number(match[1]) : DEFAULT_SEND_HOUR;
}

function preferencesFor(row: PreferenceRow | undefined, userId: number): PreferenceRow {
  return {
    user_id: userId,
    email: row?.email ?? true,
    push: row?.push ?? true,
    in_app: row?.in_app ?? true,
    windows: row?.windows?.length ? row.windows : DEFAULT_WINDOWS,
    quiet_until: row?.quiet_until ?? null,
    timezone: row?.timezone || DEFAULT_TIMEZONE,
    daily_within: row?.daily_within ?? null,
  };
}

function remainingFor(coupon: CouponRow): number {
  return Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
}

function whenLabel(days: number): string {
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  return `בעוד ${days} ימים`;
}

function summaryText(coupons: CouponRow[], days: number): string {
  const names = coupons.map((c) => `${c.company} (${remainingFor(c).toFixed(2)} ₪)`).join(', ');
  return `הקופונים הבאים עומדים לפוג ${whenLabel(days)}: ${names}`;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    console.error('[send-expiry-alerts] BREVO_API_KEY missing, skipping email');
    return false;
  }

  try {
    const resp = await safeFetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: Deno.env.get('BREVO_SENDER_EMAIL') || 'hello@itaykarkason.com',
          name: Deno.env.get('BREVO_SENDER_NAME') || 'Coupon Master',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        headers,
      }),
    });
    return resp.ok;
  } catch (error) {
    console.error('[send-expiry-alerts] email error:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    // Three ways in: the hourly pg_cron job with its dedicated token, the
    // service role, or an admin triggering a run by hand. The ledger is what
    // keeps a manual run from re-sending, so extra calls are harmless.
    if (!isCronCall(req) && !isServiceRoleCall(req)) await requireAdmin(req);

    const supabase = createServiceClient();

    const [{ data: users }, { data: prefRows }] = await Promise.all([
      supabase.from('users').select('id, email, first_name').eq('is_deleted', false),
      supabase.from('notification_preferences')
        .select('user_id, email, push, in_app, windows, quiet_until, timezone, daily_within'),
    ]);

    if (!users?.length) {
      return jsonResponse({ users: 0, due: 0, email: 0, push: 0, inApp: 0, alerts: 0 });
    }

    const prefsByUser = new Map<number, PreferenceRow>(
      (prefRows as PreferenceRow[] || []).map((row) => [row.user_id, row]),
    );

    // Work out who is due right now, and which calendar dates matter to them.
    // Users still inside their quiet window are simply not due this hour — the
    // next hourly run picks them up.
    const dueUsers: Array<{ user: UserRow; prefs: PreferenceRow; targets: Map<string, number> }> = [];
    const allTargetDates = new Set<string>();

    for (const user of users as UserRow[]) {
      const prefs = preferencesFor(prefsByUser.get(user.id), user.id);
      if (!prefs.email && !prefs.push && !prefs.in_app) continue;

      const timeZone = prefs.timezone || DEFAULT_TIMEZONE;
      if (localHourInTimeZone(timeZone) < sendHour(prefs.quiet_until)) continue;

      const today = todayInTimeZone(timeZone);
      const targets = new Map<string, number>();
      // Daily mode covers every day inside its reach; the fixed windows still
      // apply outside it (a 30-day heads-up under a 14-day daily reach).
      const offsets = new Set<number>(prefs.windows || DEFAULT_WINDOWS);
      if (prefs.daily_within !== null) {
        for (let days = 0; days <= prefs.daily_within; days += 1) offsets.add(days);
      }
      for (const days of offsets) {
        const date = addDays(today, days);
        targets.set(date, days);
        allTargetDates.add(date);
      }
      dueUsers.push({ user, prefs, targets });
    }

    if (!dueUsers.length || !allTargetDates.size) {
      return jsonResponse({ users: users.length, due: 0, email: 0, push: 0, inApp: 0, alerts: 0 });
    }

    // Three bulk reads instead of a query per user per window.
    const dueUserIds = dueUsers.map((entry) => entry.user.id);

    const [{ data: coupons }, { data: subscriptions }] = await Promise.all([
      supabase.from('coupon')
        .select('id, user_id, company, value, used_value, expiration')
        .eq('status', ACTIVE_STATUS)
        .in('user_id', dueUserIds)
        .in('expiration', [...allTargetDates]),
      supabase.from('push_subscriptions')
        .select('endpoint, subscription, kind, expo_token, user_id')
        .in('user_id', dueUserIds),
    ]);

    if (!coupons?.length) {
      return jsonResponse({
        users: users.length, due: dueUsers.length, email: 0, push: 0, inApp: 0, alerts: 0,
      });
    }

    const couponsByUser = new Map<number, CouponRow[]>();
    for (const coupon of coupons as CouponRow[]) {
      const list = couponsByUser.get(coupon.user_id) || [];
      list.push(coupon);
      couponsByUser.set(coupon.user_id, list);
    }

    const subsByUser = new Map<number, PushSubscriptionRow[]>();
    for (const row of (subscriptions || []) as Array<PushSubscriptionRow & { user_id: number }>) {
      const list = subsByUser.get(row.user_id) || [];
      list.push(row);
      subsByUser.set(row.user_id, list);
    }

    // Everything already delivered for these coupons. This is the guard that
    // makes repeat runs safe — the ledger is read before sending, not only
    // written after it.
    const { data: ledger } = await supabase
      .from('coupon_alerts')
      .select('coupon_id, window_days, channel')
      .eq('status', 'sent')
      .in('coupon_id', (coupons as CouponRow[]).map((c) => c.id));

    const alreadySent = new Set(
      (ledger || []).map((row: any) => `${row.coupon_id}:${row.window_days}:${row.channel}`),
    );
    const deliveredKey = (couponId: number, days: number, channel: Channel) =>
      `${couponId}:${days}:${channel}`;

    let emailCount = 0;
    let pushCount = 0;
    let inAppCount = 0;
    let alertCount = 0;

    for (const { user, prefs, targets } of dueUsers) {
      const userCoupons = couponsByUser.get(user.id);
      if (!userCoupons?.length) continue;

      // Group this user's due coupons by the window they fall into.
      const byWindow = new Map<number, CouponRow[]>();
      for (const coupon of userCoupons) {
        const days = targets.get(coupon.expiration);
        if (days === undefined) continue;
        const list = byWindow.get(days) || [];
        list.push(coupon);
        byWindow.set(days, list);
      }

      const rows: LedgerRow[] = [];

      for (const [days, windowCoupons] of byWindow) {
        const pending: Record<Channel, CouponRow[]> = { email: [], push: [], in_app: [] };
        for (const channel of CHANNELS) {
          if (!prefs[channel]) continue;
          pending[channel] = windowCoupons.filter(
            (c) => !alreadySent.has(deliveredKey(c.id, days, channel)),
          );
        }

        const record = (channel: Channel, ok: boolean) => {
          for (const coupon of pending[channel]) {
            rows.push({
              coupon_id: coupon.id,
              user_id: user.id,
              window_days: days,
              channel,
              status: ok ? 'sent' : 'failed',
            });
            if (ok) alreadySent.add(deliveredKey(coupon.id, days, channel));
          }
        };

        if (pending.email.length && user.email) {
          const count = pending.email.length;
          const subject = `תזכורת: ${count === 1 ? 'קופון עומד לפוג' : `${count} קופונים עומדים לפוג`}`;
          const ok = await sendEmail(
            user.email,
            subject,
            expiryEmailHtml({
              firstName: user.first_name || '',
              days,
              coupons: pending.email.map((c) => ({
                company: c.company,
                remaining: remainingFor(c),
                expiration: c.expiration,
              })),
              appUrl: Deno.env.get('APP_BASE_URL') || null,
              unsubscribeUrl: await buildUnsubscribeUrl(user.id, user.email),
            }),
            await buildUnsubscribeHeaders(user.id, user.email),
          );
          if (ok) emailCount += 1;
          record('email', ok);
        }

        // A user with the channel on but no registered device is not a failure
        // to retry every hour — there is simply nowhere to send.
        const subs = subsByUser.get(user.id) || [];
        if (pending.push.length && subs.length) {
          const stats = await sendPushToRows(supabase, subs, {
            title: 'קופון מאסטר',
            body: summaryText(pending.push, days),
            url: '/notifications',
            tag: `expiry-${days}-${user.id}`,
            renotify: true,
          });
          const ok = stats.sent > 0;
          if (ok) pushCount += 1;
          record('push', ok);
        }

        if (pending.in_app.length) {
          const { error } = await supabase.from('notifications').insert({
            user_id: user.id,
            message: summaryText(pending.in_app, days),
            link: '/notifications',
            shown: false,
            viewed: false,
            hide_from_view: false,
          });
          if (!error) inAppCount += 1;
          record('in_app', !error);
        }
      }

      // Written per user rather than once at the end: a timeout halfway through
      // the run must not lose the record of mail that already went out.
      if (rows.length) {
        const { data: inserted, error } = await supabase
          .from('coupon_alerts')
          .upsert(rows, { onConflict: 'coupon_id,window_days,channel', ignoreDuplicates: true })
          .select('id');
        if (error) console.error('[send-expiry-alerts] ledger error:', error.message);
        else alertCount += inserted?.length || 0;
      }
    }

    return jsonResponse({
      users: users.length,
      due: dueUsers.length,
      email: emailCount,
      push: pushCount,
      inApp: inAppCount,
      alerts: alertCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[send-expiry-alerts] fatal:', err);
    return jsonResponse({ error: message }, 500);
  }
});
