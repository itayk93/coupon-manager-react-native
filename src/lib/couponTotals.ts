import type { DecryptedCoupon } from "@/hooks/useCoupons";

/**
 * One definition of "a coupon that still counts", shared by the dashboard, the
 * wallet hero card and the home-screen widget.
 *
 * These used to be three separate expressions, and they had drifted: the widget
 * counted `status === "פעיל"` and excluded one-time coupons from the balance,
 * so it showed 33 / ₪3,691 while the dashboard showed 35 / ₪4315.21 for the
 * same wallet. Import from here rather than re-deriving the rule.
 */
export function isSpendableCoupon(coupon: DecryptedCoupon): boolean {
  return coupon.status !== "נוצל";
}

export function couponRemainingValue(coupon: DecryptedCoupon): number {
  return (coupon.value ?? 0) - (coupon.used_value ?? 0);
}

/**
 * Total still available to spend. One-time coupons are included: their whole
 * face value is spendable until they are marked used, which is exactly what the
 * wallet balance means to the user.
 */
export function totalRemainingValue(coupons: DecryptedCoupon[]): number {
  return coupons.filter(isSpendableCoupon).reduce((sum, c) => sum + couponRemainingValue(c), 0);
}
