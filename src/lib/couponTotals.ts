import type { DecryptedCoupon } from "@/types/coupon";
import { daysUntil } from "./formatDate";

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

export function couponUsedValue(coupon: { used_value?: number | null; ledger_used_value?: number }): number {
  return Math.max(coupon.used_value ?? 0, coupon.ledger_used_value ?? 0);
}

export function couponRemainingValue(coupon: DecryptedCoupon): number {
  return (coupon.value ?? 0) - couponUsedValue(coupon);
}

/**
 * Balance to announce right after recording usage. The server returns the stored
 * total, which can trail the ledger, so the lower of the two readings wins.
 * `added` is null when it is unknown how much of a batch was inserted.
 */
export function remainingAfterUsage(coupon: DecryptedCoupon, newStoredUsed: number, added: number | null): number {
  return Math.max(0, Math.min((coupon.value ?? 0) - newStoredUsed, couponRemainingValue(coupon) - (added ?? 0)));
}

export function isCouponUsed(coupon: DecryptedCoupon): boolean {
  return coupon.status === "נוצל" || couponRemainingValue(coupon) <= 0;
}

export function isCouponExpired(coupon: DecryptedCoupon, now = new Date()): boolean {
  if (!coupon.expiration) return false;
  const days = daysUntil(coupon.expiration, now);
  return days !== null && days < 0;
}

/**
 * Total still available to spend. One-time coupons are included: their whole
 * face value is spendable until they are marked used, which is exactly what the
 * wallet balance means to the user.
 */
export function totalRemainingValue(coupons: DecryptedCoupon[]): number {
  return coupons.filter(isSpendableCoupon).reduce((sum, c) => sum + couponRemainingValue(c), 0);
}

