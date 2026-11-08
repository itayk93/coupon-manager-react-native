import type { DecryptedCoupon } from "@/types/coupon";
import { daysUntil } from "./formatDate";
import { couponRemainingValue, isSpendableCoupon } from "./couponTotals";

/**
 * What the mascot on the alternative home screen says, and how worried it looks.
 *
 * Kept here, away from the component, for the same reason `couponTotals` exists:
 * the widget, the expiry banner and the home screen must never disagree about
 * which coupons are urgent. Spendability comes from `isSpendableCoupon`, and the
 * day count is the calendar-day count `ExpiringCouponsBanner` already uses — 0 is
 * "expires today", 1 is "expires tomorrow" — so the headline and the banner can
 * never be a day apart.
 */

/** Four states are enough for the first version: no room, no XP, no wardrobe. */
export type HomeMascotState = "happy" | "concerned" | "panic" | "empty";

/** Outside this many days a coupon is not worth mentioning on the home screen. */
export const HOME_HERO_WINDOW_DAYS = 14;
/** "This week" for the headline's purposes. */
export const HOME_HERO_WEEK_DAYS = 7;

export type HomeHeroSummary = {
  state: HomeMascotState;
  message: string;
  /** Days to the nearest expiry inside the window, or null when nothing is close. */
  nearestDays: number | null;
  /** How many coupons the message is about. 0 when it is not about any. */
  urgentCount: number;
  /** True when tapping the bubble should open the expiring list. */
  linksToExpiring: boolean;
};

export const daysUntilExpiry = daysUntil;

export type ExpiringCoupon = { coupon: DecryptedCoupon; days: number };

/**
 * Spendable coupons expiring inside the window, most urgent first.
 *
 * Ties go to the coupon with the most money left on it: two coupons expiring on
 * the same day, and the one worth ₪200 is the one worth opening first. Already
 * expired coupons are left out — there is nothing left to rescue.
 */
export function expiringSoon(
  coupons: DecryptedCoupon[],
  now: Date = new Date(),
  windowDays: number = HOME_HERO_WINDOW_DAYS
): ExpiringCoupon[] {
  return coupons
    .filter(isSpendableCoupon)
    .map((coupon) => ({ coupon, days: daysUntilExpiry(coupon.expiration, now) }))
    .filter((entry): entry is ExpiringCoupon =>
      entry.days !== null && entry.days >= 0 && entry.days <= windowDays
    )
    .sort((a, b) => {
      if (a.days !== b.days) return a.days - b.days;
      return couponRemainingValue(b.coupon) - couponRemainingValue(a.coupon);
    });
}

/**
 * The headline and the mascot's face.
 *
 * The ladder is deliberately short: today, this week, this fortnight, calm,
 * empty. Anything finer reads as noise on a screen the user opens to spend a
 * coupon, not to be briefed.
 */
export function homeHeroSummary(
  coupons: DecryptedCoupon[],
  now: Date = new Date()
): HomeHeroSummary {
  const spendable = coupons.filter(isSpendableCoupon);
  if (spendable.length === 0) {
    return {
      state: "empty",
      message: "בוא נוסיף את הקופון הראשון שלך",
      nearestDays: null,
      urgentCount: 0,
      linksToExpiring: false,
    };
  }

  const expiring = expiringSoon(coupons, now);
  const nearestDays = expiring.length ? expiring[0].days : null;
  const state: HomeMascotState =
    nearestDays === null ? "happy" : nearestDays <= 1 ? "panic" : nearestDays <= HOME_HERO_WEEK_DAYS ? "concerned" : "happy";

  const today = expiring.filter((entry) => entry.days === 0);
  if (today.length > 0) {
    return {
      state,
      message:
        today.length === 1
          ? "קופון אחד צריך אותך היום!"
          : `יש לך ${today.length} קופונים שצריך להציל היום!`,
      nearestDays,
      urgentCount: today.length,
      linksToExpiring: true,
    };
  }

  const thisWeek = expiring.filter((entry) => entry.days <= HOME_HERO_WEEK_DAYS);
  if (thisWeek.length > 0) {
    return {
      state,
      message:
        thisWeek.length === 1
          ? "יש לך קופון אחד שכדאי לנצל השבוע!"
          : `יש לך ${thisWeek.length} קופונים שכדאי לנצל השבוע!`,
      nearestDays,
      urgentCount: thisWeek.length,
      linksToExpiring: true,
    };
  }

  if (expiring.length > 0) {
    return {
      state,
      message: "כדאי לשים עין 👀",
      nearestDays,
      urgentCount: expiring.length,
      linksToExpiring: true,
    };
  }

  return {
    state: "happy",
    message: "הכול רגוע. הקופונים שלך מסודרים ✨",
    nearestDays: null,
    urgentCount: 0,
    linksToExpiring: false,
  };
}

/**
 * Quick-filter chips built from the tags the user actually has.
 *
 * No category guessing: an app that labels a coupon "אוכל" because the company
 * name sounds like a restaurant is wrong often enough to be worse than nothing.
 * Ordered by how many coupons carry the tag, then alphabetically so the row does
 * not reshuffle between renders of an equal-count wallet.
 */
export function topCouponTags(
  coupons: DecryptedCoupon[],
  tagsMap: Record<number, string[]>,
  limit: number = 4
): string[] {
  const counts = new Map<string, number>();
  for (const coupon of coupons) {
    if (!isSpendableCoupon(coupon)) continue;
    for (const tag of tagsMap[coupon.id] || []) {
      const name = tag.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he"))
    .slice(0, limit)
    .map(([name]) => name);
}
