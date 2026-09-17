import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { companyKey } from "./companyName";

/** One company tile: the name as the user wrote it, and how many it holds. */
export type CompanyCard = { company: string; count: number };

/** The parts of `CouponUsageStats` this ordering reads. */
export type CompanyUsage = {
  usageCountByCompany?: Record<string, number>;
  latestUsageByCompany?: Record<string, number>;
};

/**
 * The companies in a wallet, most recently reached for first.
 *
 * The dashboard, the Kuponi home screen and the companies screen all draw the
 * same grid, and the ordering was written out three times before this existed.
 * That is exactly the drift `couponTotals.ts` was created to stop: a shop must
 * not be near the top on one screen and buried on another, and three copies of
 * a four-step comparator is how that happens.
 *
 * The steps: last used, then used most, then the biggest pile of coupons, then
 * alphabetically — so a wallet of equal, never-used companies does not
 * reshuffle itself between renders.
 *
 * Companies are grouped by `companyKey`, which is what decides that "סופר פארם"
 * and "סופר-פארם" are one shop; the name shown is the one the first of them
 * carries.
 */
export function companyCards(
  coupons: DecryptedCoupon[],
  usage?: CompanyUsage | null
): CompanyCard[] {
  const byKey = new Map<string, CompanyCard>();
  for (const coupon of coupons) {
    const key = companyKey(coupon.company);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { company: (coupon.company || "ללא חברה").trim(), count: 1 });
  }

  const latest = usage?.latestUsageByCompany || {};
  const used = usage?.usageCountByCompany || {};
  return [...byKey.values()].sort(
    (a, b) =>
      (latest[b.company] || 0) - (latest[a.company] || 0) ||
      (used[b.company] || 0) - (used[a.company] || 0) ||
      b.count - a.count ||
      a.company.localeCompare(b.company, "he")
  );
}
