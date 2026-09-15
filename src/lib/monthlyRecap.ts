import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { couponRemainingValue } from "./couponTotals";

/**
 * What a month came to: what was saved, and what was let go.
 *
 * Both halves matter. A recap that only counts savings is a scoreboard, and
 * the thing this product actually protects against is the other number — a
 * coupon quietly reaching its date with money still on it. Naming that is the
 * whole reason the character exists, so the month says it out loud.
 *
 * Pure over the wallet and the savings-by-month map the statistics screen
 * already fetches, so the page needs no query of its own.
 */

export type MonthlyRecap = {
  /** `${year}-${monthIndex}`, the key `savingsByMonth` uses. */
  key: string;
  label: string;
  saved: number;
  previousSaved: number;
  /** Positive when this month beat the last one. */
  delta: number;
  /** Spendable coupons that reached their date this month with money left. */
  lostCount: number;
  lostValue: number;
  /** True when nothing expired unused — worth saying, and it is a scene. */
  clean: boolean;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

/** Coupons that expired inside the month with money still on them. */
function lostIn(coupons: DecryptedCoupon[], start: Date, end: Date): DecryptedCoupon[] {
  return coupons.filter((coupon) => {
    if (coupon.status === "נוצל") return false;
    if (couponRemainingValue(coupon) <= 0) return false;
    if (!coupon.expiration) return false;
    const expiry = new Date(coupon.expiration);
    if (Number.isNaN(expiry.getTime())) return false;
    const day = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()).getTime();
    return day >= start.getTime() && day < end.getTime();
  });
}

export function monthlyRecap(
  coupons: DecryptedCoupon[],
  savingsByMonth: Record<string, number>,
  now: Date = new Date()
): MonthlyRecap {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const saved = savingsByMonth[monthKey(start)] ?? 0;
  const previousSaved = savingsByMonth[monthKey(previous)] ?? 0;

  // Only days that have already passed can have lost anything; a coupon
  // expiring later this month is still rescuable and belongs on the at-risk
  // page, not in the tally of what was let go.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lost = lostIn(coupons, start, today);

  return {
    key: monthKey(start),
    label: start.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
    saved,
    previousSaved,
    delta: saved - previousSaved,
    lostCount: lost.length,
    lostValue: lost.reduce((sum, coupon) => sum + couponRemainingValue(coupon), 0),
    clean: lost.length === 0,
  };
}
