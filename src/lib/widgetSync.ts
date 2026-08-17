import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { resolveCompanyLogo } from "@/lib/companyLogos";
import {
  couponRemainingValue,
  isSpendableCoupon,
  totalRemainingValue,
} from "@/lib/couponTotals";
import {
  setWidgetData,
  type WidgetPayload,
  type WidgetCouponPayload,
} from "../../modules/coupon-widget";

/** The home-screen widget never shows more than this many cards, even on Large. */
export const MAX_WIDGET_COUPONS = 4;

/**
 * Precomputes everything the native widgets render, so neither platform has to
 * know about coupon business rules, encryption, or logo resolution.
 *
 * The counts and balance deliberately use the same predicate as the dashboard
 * (`isSpendableCoupon`) so the widget and the app can never disagree.
 */
export function buildWidgetPayload(coupons: DecryptedCoupon[]): WidgetPayload {
  const spendable = coupons.filter(isSpendableCoupon);

  const selected: WidgetCouponPayload[] = spendable
    .filter((coupon) => coupon.show_in_widget === true && couponRemainingValue(coupon) > 0)
    .sort((a, b) => (a.widget_display_order ?? 999) - (b.widget_display_order ?? 999))
    .slice(0, MAX_WIDGET_COUPONS)
    .map((coupon) => ({
      id: coupon.id,
      company: coupon.company,
      code: coupon.code,
      remainingValue: couponRemainingValue(coupon),
      expiration: coupon.expiration ?? null,
      logoUrl: resolveCompanyLogo(coupon.company) || null,
    }));

  return {
    updatedAt: new Date().toISOString(),
    activeCouponsCount: spendable.length,
    oneTimeCouponsCount: spendable.filter((coupon) => coupon.is_one_time === true).length,
    totalRemainingValue: totalRemainingValue(coupons),
    coupons: selected,
  };
}

export function syncWidget(coupons: DecryptedCoupon[]): void {
  setWidgetData(buildWidgetPayload(coupons));
}
