import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { couponRemainingValue, isSpendableCoupon } from "./couponTotals";

/** The home-screen widget never shows more than this many cards, even on Large. */
export const MAX_WIDGET_COUPONS = 4;

/**
 * Who may sit in the home-screen widget, and in what order.
 *
 * The widget settings screen and the payload builder each had their own copy of
 * this rule, and the coupon detail screen now needs it too. Import from here so
 * a coupon can never be addable on one screen and invisible on another.
 */

export function isWidgetEligible(coupon: DecryptedCoupon): boolean {
  return isSpendableCoupon(coupon) && couponRemainingValue(coupon) > 0;
}

export function isInWidget(coupon: DecryptedCoupon): boolean {
  return coupon.show_in_widget === true;
}

/** The chosen coupons in the order the widget renders them. */
export function widgetSelection(coupons: DecryptedCoupon[]): DecryptedCoupon[] {
  return coupons
    .filter((coupon) => isWidgetEligible(coupon) && isInWidget(coupon))
    .sort((a, b) => (a.widget_display_order ?? 999) - (b.widget_display_order ?? 999));
}

export function isWidgetFull(coupons: DecryptedCoupon[]): boolean {
  return widgetSelection(coupons).length >= MAX_WIDGET_COUPONS;
}

/** Where a newly added coupon goes: last, keeping the order contiguous. */
export function nextWidgetOrder(coupons: DecryptedCoupon[]): number {
  return widgetSelection(coupons).length;
}
