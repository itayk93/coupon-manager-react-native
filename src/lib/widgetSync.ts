import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { resolveCompanyLogo } from "@/lib/companyLogos";
import {
  setWidgetData,
  type WidgetPayload,
  type WidgetCouponPayload,
} from "../../modules/coupon-widget";

const ACTIVE_STATUS = "פעיל";

/** The home-screen widget never shows more than this many cards, even on Large. */
export const MAX_WIDGET_COUPONS = 4;

function remainingValue(coupon: DecryptedCoupon): number {
  return (coupon.value ?? 0) - (coupon.used_value ?? 0);
}

function isActive(coupon: DecryptedCoupon): boolean {
  return coupon.status === ACTIVE_STATUS;
}

/**
 * Precomputes everything the native widgets render, so neither platform has to
 * know about coupon business rules, encryption, or logo resolution.
 */
export function buildWidgetPayload(coupons: DecryptedCoupon[]): WidgetPayload {
  const active = coupons.filter(isActive);

  // One-time coupons have no meaningful remaining balance, so they are counted
  // but excluded from the total — same rule as the original iOS widget.
  const totalRemainingValue = active
    .filter((coupon) => !coupon.is_one_time)
    .reduce((sum, coupon) => sum + remainingValue(coupon), 0);

  const selected: WidgetCouponPayload[] = active
    .filter((coupon) => coupon.show_in_widget === true && remainingValue(coupon) > 0)
    .sort((a, b) => (a.widget_display_order ?? 999) - (b.widget_display_order ?? 999))
    .slice(0, MAX_WIDGET_COUPONS)
    .map((coupon) => ({
      id: coupon.id,
      company: coupon.company,
      code: coupon.code,
      remainingValue: remainingValue(coupon),
      expiration: coupon.expiration ?? null,
      logoUrl: resolveCompanyLogo(coupon.company) || null,
    }));

  return {
    updatedAt: new Date().toISOString(),
    activeCouponsCount: active.length,
    oneTimeCouponsCount: active.filter((coupon) => coupon.is_one_time === true).length,
    totalRemainingValue,
    coupons: selected,
  };
}

export function syncWidget(coupons: DecryptedCoupon[]): void {
  setWidgetData(buildWidgetPayload(coupons));
}
