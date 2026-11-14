import type { DecryptedCoupon } from "@/hooks/useCoupons";
import type { CouponUsageStats } from "@/hooks/useCouponUsage";

import { isSpendableCoupon } from "./couponTotals";

/**
 * The dashboard's visible coupon selection and ordering: spendable coupons
 * only, most recently used first, then most often used, then newest.
 *
 * Extracted from HomeScreen so the /company-sheet native form sheet lists the
 * EXACT same rows the hand-rolled modal sheet listed - the modal was fed this
 * same filtered, sorted array. One source of truth, one behavior.
 */
export function dashboardVisibleCoupons(
  coupons: DecryptedCoupon[],
  usageStats: CouponUsageStats | undefined
): DecryptedCoupon[] {
  const spendable = coupons.filter(isSpendableCoupon);
  const couponUsage = usageStats?.usageCountByCoupon || {};
  return spendable.sort((a, b) => {
    const latestA = usageStats?.latestUsageByCoupon?.[a.id] || 0;
    const latestB = usageStats?.latestUsageByCoupon?.[b.id] || 0;
    if (latestA !== latestB) return latestB - latestA;

    const usageA = couponUsage[a.id] || 0;
    const usageB = couponUsage[b.id] || 0;
    if (usageA !== usageB) return usageB - usageA;

    const dateA = a.date_added ? new Date(a.date_added).getTime() : 0;
    const dateB = b.date_added ? new Date(b.date_added).getTime() : 0;
    return dateB - dateA;
  });
}
