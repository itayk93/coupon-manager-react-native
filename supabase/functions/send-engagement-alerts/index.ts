// Supabase Edge Function: send-engagement-alerts
//
// The four things worth saying that nobody triggers by doing anything:
//
//   monthly_summary    what last month was worth, once a month
//   idle_money         balance nobody has looked at in a season
//   coupon_milestone   the 1st, 10th, 50th, 100th coupon in the wallet
//   expired_unused     a coupon that ran out with money still on it
//
// All four are recomputed from the same coupon rows on every run — none of them
// is an event that happens once. What keeps them from repeating is the
// notification_events ledger, through the dedupe key each one picks below.
//
// Invoked daily by pg_cron. Runs hourly-safe: a user inside their quiet window
// is skipped by deliver() and picked up on the next run.
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  - injected automatically
//   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME - email delivery
//   UNSUBSCRIBE_SECRET, APP_BASE_URL         - links in the mail footer
//   ENGAGEMENT_CRON_TOKEN (falls back to EXPIRY_CRON_TOKEN) - the pg_cron job
//   SSRF_ALLOWED_HOSTS must include api.brevo.com and exp.host

import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { isServiceRoleCall, requireAdmin } from '../_shared/auth.ts';
import { createServiceClient, type PushSubscriptionRow } from '../_shared/push.ts';
import { deliver, type DeliveryPrefs, type DeliveryUser } from '../_shared/deliver.ts';
import { money, monthName } from '../_shared/notificationTypes.ts';

const DEFAULT_TIMEZONE = 'Asia/Jerusalem';
const ACTIVE_STATUS = 'פעיל';

/** A balance nobody has opened in this long is money the app should mention. */
const IDLE_DAYS = 90;
/** Below this, a reminder about idle money is not worth a notification. */
const IDLE_MIN_AMOUNT = 50;
/** The monthly summary goes out in the first days of the month, once. */
const SUMMARY_WINDOW_DAYS = 3;
/** A coupon that expired within this many days is still worth mentioning. */
const EXPIRED_LOOKBACK_DAYS = 3;

const COUPON_COUNTS = [1, 10, 50, 100];

type UserRow = { id: number; public_id: string; email: string; first_name: string | null };

type PrefRow = DeliveryPrefs & { user_id: number };

type CouponRow = {
  id: number;
  public_id: string;
  user_id: number;
  company: string;
  value: number | null;
  cost: number | null;
  used_value: number | null;
  status: string | null;
  expiration: string | null;
  date_added: string | null;
  last_detail_view: string | null;
  last_code_view: string | null;
};

function isCronCall(req: Request): boolean {
  const expected = Deno.env.get('ENGAGEMENT_CRON_TOKEN') || Deno.env.get('EXPIRY_CRON_TOKEN');
  const presented = req.headers.get('x-cron-token');
  if (!expected || !presented || expected.length !== presented.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return diff === 0;
}

function prefsFor(row: PrefRow | undefined): DeliveryPrefs {
  return {
    email: row?.email ?? true,
    push: row?.push ?? true,
    in_app: row?.in_app ?? true,
    quiet_until: row?.quiet_until ?? null,
    timezone: row?.timezone || DEFAULT_TIMEZONE,
    type_channels: row?.type_channels ?? null,
  };
}

function remainingFor(coupon: CouponRow): number {
  return Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return Infinity;
  return (Date.now() - time) / (1000 * 60 * 60 * 24);
}

/** The most recent time this coupon was opened, added, or spent from. */
function lastTouched(coupon: CouponRow): number {
  return Math.min(
    daysSince(coupon.date_added),
    daysSince(coupon.last_detail_view),
    daysSince(coupon.last_code_view),
  );
}

/**
 * Savings in a calendar month, defined exactly as the app's own chart defines
 * it: value spent from coupons added that month. Two definitions of "what you
 * saved in August" — one in the email, one on the screen it links to — is worse
 * than one imperfect definition used everywhere.
 */
function monthlySpend(coupons: CouponRow[], year: number, month: number): number {
  return coupons.reduce((sum, coupon) => {
    if (!coupon.date_added) return sum;
    const date = new Date(coupon.date_added);
    if (date.getFullYear() !== year || date.getMonth() !== month) return sum;
    return sum + (coupon.used_value || 0);
  }, 0);
}

function everyMonthlySpend(coupons: CouponRow[]): number[] {
  const buckets = new Map<string, number>();
  for (const coupon of coupons) {
    if (!coupon.date_added) continue;
    const date = new Date(coupon.date_added);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    buckets.set(key, (buckets.get(key) || 0) + (coupon.used_value || 0));
  }
  return [...buckets.values()];
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!isCronCall(req) && !isServiceRoleCall(req)) {
      await requireAdmin(req);
    }

    const supabase = createServiceClient();

    const [{ data: users }, { data: prefRows }] = await Promise.all([
      supabase.from('users').select('id, public_id, email, first_name'),
      supabase.from('notification_preferences')
        .select('user_id, email, push, in_app, quiet_until, timezone, type_channels'),
    ]);

    if (!users?.length) return jsonResponse({ users: 0, sent: 0 });

    const prefsByUser = new Map<number, PrefRow>(
      ((prefRows as PrefRow[]) || []).map((row) => [row.user_id, row]),
    );

    const userIds = (users as UserRow[]).map((user) => user.id);

    const [{ data: coupons }, { data: subscriptions }] = await Promise.all([
      supabase.from('coupon')
        .select('id, public_id, user_id, company, value, cost, used_value, status, expiration, date_added, last_detail_view, last_code_view')
        .in('user_id', userIds),
      supabase.from('push_subscriptions')
        .select('endpoint, subscription, kind, expo_token, user_id')
        .in('user_id', userIds),
    ]);

    const couponsByUser = new Map<number, CouponRow[]>();
    for (const coupon of ((coupons as CouponRow[]) || [])) {
      const list = couponsByUser.get(coupon.user_id) || [];
      list.push(coupon);
      couponsByUser.set(coupon.user_id, list);
    }

    const subsByUser = new Map<number, PushSubscriptionRow[]>();
    for (const row of ((subscriptions || []) as Array<PushSubscriptionRow & { user_id: number }>)) {
      const list = subsByUser.get(row.user_id) || [];
      list.push(row);
      subsByUser.set(row.user_id, list);
    }

    const now = new Date();
    const summaryDue = now.getDate() <= SUMMARY_WINDOW_DAYS;
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const sent: Record<string, number> = {
      monthly_summary: 0, idle_money: 0,
      coupon_milestone: 0, expired_unused: 0,
    };

    for (const user of users as UserRow[]) {
      const userCoupons = couponsByUser.get(user.id) || [];
      if (!userCoupons.length) continue;

      const deliveryUser: DeliveryUser = {
        id: user.id, public_id: user.public_id, email: user.email, first_name: user.first_name,
      };
      const prefs = prefsFor(prefsByUser.get(user.id));
      const subscriptions = subsByUser.get(user.id) || [];
      const send = (
        type: Parameters<typeof deliver>[1]['type'],
        payload: Record<string, any>,
        dedupeKey: string,
        highlight?: string,
        ctaLabel?: string,
      ) => deliver(supabase, {
        user: deliveryUser, prefs, type, payload, dedupeKey, subscriptions,
        highlight: highlight ?? null, ctaLabel: ctaLabel ?? null,
      });

      // 1. Last month, if there was anything to report.
      if (summaryDue) {
        const year = previous.getFullYear();
        const month = previous.getMonth();
        const amount = monthlySpend(userCoupons, year, month);
        if (amount > 0) {
          const isBest = everyMonthlySpend(userCoupons).every((value) => value <= amount);
          const result = await send(
            'monthly_summary',
            { year, month, amount, isBest },
            `${year}-${String(month + 1).padStart(2, '0')}`,
            `${monthName(month)}: ${money(amount)}`,
            'לסטטיסטיקה המלאה',
          );
          if (result.in_app || result.push || result.email) sent.monthly_summary += 1;
        }
      }

      // 2. Balance nobody has looked at in a season.
      const idle = userCoupons.filter((coupon) =>
        coupon.status === ACTIVE_STATUS
        && remainingFor(coupon) > 0
        && lastTouched(coupon) >= IDLE_DAYS
      );
      const idleAmount = idle.reduce((sum, coupon) => sum + remainingFor(coupon), 0);
      if (idleAmount >= IDLE_MIN_AMOUNT) {
        // Monthly at most: the money stays idle, and saying so every day is how
        // a useful reminder turns into something people mute.
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const result = await send(
          'idle_money',
          {
            amount: idleAmount,
            months: Math.floor(IDLE_DAYS / 30),
            couponIds: idle.map((coupon) => coupon.public_id),
          },
          monthKey,
          money(idleAmount),
          'לארנק שלי',
        );
        if (result.in_app || result.push || result.email) sent.idle_money += 1;
      }

      // 3. Wallet size crossing a round number.
      const reachedCount = COUPON_COUNTS.filter((count) => userCoupons.length >= count);
      const highestCount = reachedCount[reachedCount.length - 1];
      if (highestCount) {
        const result = await send(
          'coupon_milestone', { count: highestCount }, String(highestCount),
          undefined, 'לארנק שלי',
        );
        if (result.in_app || result.push || result.email) sent.coupon_milestone += 1;
      }

      // 4. A coupon that ran out with money still on it. Once per coupon,
      //    ever — this is the one message that carries bad news.
      const today = new Date().toISOString().slice(0, 10);
      for (const coupon of userCoupons) {
        if (!coupon.expiration || coupon.expiration >= today) continue;
        if (daysSince(coupon.expiration) > EXPIRED_LOOKBACK_DAYS) continue;
        const remaining = remainingFor(coupon);
        if (remaining <= 0) continue;
        const result = await send(
          'expired_unused',
          { company: coupon.company, remaining },
          String(coupon.id),
          money(remaining),
          'לכוונון התזכורות',
        );
        if (result.in_app || result.push || result.email) sent.expired_unused += 1;
      }
    }

    return jsonResponse({ users: users.length, sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    if (message === 'FORBIDDEN') return jsonResponse({ error: message }, 403);
    console.error('[send-engagement-alerts] fatal:', err);
    return jsonResponse({ error: 'internal error' }, 500);
  }
});
