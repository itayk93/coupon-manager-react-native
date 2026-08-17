import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { prepareWidgetLogos } from "@/lib/widgetLogos";
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

  const chosen = spendable
    .filter((coupon) => coupon.show_in_widget === true && couponRemainingValue(coupon) > 0)
    .sort((a, b) => (a.widget_display_order ?? 999) - (b.widget_display_order ?? 999))
    .slice(0, MAX_WIDGET_COUPONS);

  const selected: WidgetCouponPayload[] = chosen.map((coupon) => ({
    id: coupon.id,
    company: coupon.company,
    code: coupon.code,
    remainingValue: couponRemainingValue(coupon),
    expiration: coupon.expiration ?? null,
    logoFile: null,
  }));

  return {
    updatedAt: new Date().toISOString(),
    activeCouponsCount: spendable.length,
    oneTimeCouponsCount: spendable.filter((coupon) => coupon.is_one_time === true).length,
    totalRemainingValue: totalRemainingValue(coupons),
    coupons: selected,
  };
}

/**
 * Writes the payload, then upgrades it with logos.
 *
 * Deliberately two writes. Copying logo files touches the filesystem and can
 * fail; doing it before the write meant one bad copy discarded the whole
 * payload and left the widget showing stale numbers. Balances and counts are
 * the part that must never be wrong, so they land first.
 */
export async function syncWidget(
  coupons: DecryptedCoupon[],
  /** `companies.image_path` by company name, so logos resolve for companies
   *  that are not in the bundled `logoByCompany` map. */
  imagePathByCompany: Record<string, string | null> = {}
): Promise<void> {
  const payload = buildWidgetPayload(coupons);
  setWidgetData(payload);

  if (payload.coupons.length === 0) return;

  try {
    const logos = await prepareWidgetLogos(
      payload.coupons.map((coupon) => ({
        couponId: coupon.id,
        company: coupon.company,
        dbImagePath: imagePathByCompany[coupon.company] ?? null,
      }))
    );

    if (Object.keys(logos).length === 0) return;

    setWidgetData({
      ...payload,
      coupons: payload.coupons.map((coupon) => ({
        ...coupon,
        logoFile: logos[coupon.id] ?? null,
      })),
    });
  } catch (error) {
    // Logos are cosmetic; the numbers are already on screen.
    console.warn("[widget] failed to prepare company logos", error);
  }
}
