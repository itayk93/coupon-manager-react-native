// Which coupon to start with this week, and when balance moved on its own.
//
// Both decisions are arithmetic on the user's own rows, and they are kept that
// way on purpose: the model only ever phrases a notification (notificationVoice
// .ts), it never chooses what the notification is about. Free of Deno APIs so
// src/lib/weeklyPick.test.ts can run them on every commit.

export const ACTIVE_STATUS = 'פעיל';

/** Below this much left, a coupon is not worth a weekly nudge. */
export const PICK_MIN_REMAINING = 20;
/**
 * The pick plans ahead, so it starts where the expiry ladder's short end
 * stops: a coupon a week or less from its date already gets its own reminders.
 */
export const PICK_MIN_DAYS = 8;
/** Further out than this, there is no reason to start with it this week. */
export const PICK_MAX_DAYS = 60;

export type PickCoupon = {
  id: number;
  public_id: string;
  company: string;
  value: number | null;
  used_value: number | null;
  status: string | null;
  expiration: string | null;
};

export type WeeklyPick = {
  coupon: PickCoupon;
  remaining: number;
  daysLeft: number;
  /** Other coupons that also qualified, mentioned so the pick is not the whole story. */
  others: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function remainingFor(coupon: PickCoupon): number {
  return Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
}

/** Whole days from `today` to a `YYYY-MM-DD` expiry, counted on calendar dates. */
export function daysUntil(expiration: string, today: Date): number {
  const [year, month, day] = expiration.slice(0, 10).split('-').map(Number);
  const end = Date.UTC(year, month - 1, day);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((end - start) / DAY_MS);
}

/**
 * The coupon to start with: of those with real money left and a deadline in
 * the planning window, the one losing the most per day of waiting — the
 * remaining balance spread over the days left. Ties go to the sooner date.
 */
export function weeklyPick(coupons: PickCoupon[], today: Date): WeeklyPick | null {
  const candidates = coupons
    .filter((coupon) => coupon.status === ACTIVE_STATUS && coupon.expiration)
    .map((coupon) => ({
      coupon,
      remaining: remainingFor(coupon),
      daysLeft: daysUntil(coupon.expiration!, today),
    }))
    .filter((item) =>
      item.remaining >= PICK_MIN_REMAINING
      && item.daysLeft >= PICK_MIN_DAYS
      && item.daysLeft <= PICK_MAX_DAYS
    )
    .sort((a, b) =>
      b.remaining / b.daysLeft - a.remaining / a.daysLeft || a.daysLeft - b.daysLeft
    );

  const [best] = candidates;
  return best ? { ...best, others: candidates.length - 1 } : null;
}

/** "2026-W39": one weekly pick per ISO week, whichever hour the job runs. */
export function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The weekday in the user's own zone; Sunday is the start of the Israeli week. */
export function isSundayIn(timeZone: string, now: Date): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now) === 'Sun';
}

export type BalanceChange = {
  id: number;
  publicId: string;
  company: string;
  oldRemaining: number;
  newRemaining: number;
};

/**
 * A scraped balance lower than the app's own count means money left the
 * coupon that nobody recorded — forgotten, or not the user's doing. That is a
 * different message from "your balance was refreshed", so the two are split.
 */
export function splitBalanceChanges(changes: BalanceChange[]): {
  unrecorded: BalanceChange[];
  refreshed: BalanceChange[];
} {
  return {
    unrecorded: changes.filter((change) => change.newRemaining < change.oldRemaining),
    refreshed: changes.filter((change) => change.newRemaining >= change.oldRemaining),
  };
}
