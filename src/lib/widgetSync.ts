import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { prepareWidgetLogos } from "@/lib/widgetLogos";
import { couponRemainingValue, isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";
import { MAX_WIDGET_COUPONS, widgetSelection } from "@/lib/widgetSelection";
import {
  setWidgetData,
  type WidgetPayload,
  type WidgetCouponPayload,
} from "../../modules/coupon-widget";

export { MAX_WIDGET_COUPONS } from "@/lib/widgetSelection";

/**
 * Precomputes everything the native widgets render, so neither platform has to
 * know about coupon business rules, encryption, or logo resolution.
 *
 * The counts and balance deliberately use the same predicate as the dashboard
 * (`isSpendableCoupon`) so the widget and the app can never disagree.
 */
function daysUntilExpiration(expiration: string): number | null {
  const target = new Date(expiration);
  if (Number.isNaN(target.getTime())) return null;
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
}

export function buildWidgetPayload(coupons: DecryptedCoupon[]): WidgetPayload {
  const spendable = coupons.filter(isSpendableCoupon);

  const chosen = widgetSelection(spendable).slice(0, MAX_WIDGET_COUPONS);

  const selected: WidgetCouponPayload[] = chosen.map((coupon) => ({
    id: coupon.id,
    publicId: coupon.public_id,
    company: coupon.company,
    code: coupon.code,
    remainingValue: couponRemainingValue(coupon),
    expiration: coupon.expiration ?? null,
    logoFile: null,
    cardExp: coupon.card_exp ?? null,
    cvv: coupon.cvv ?? null,
  }));

  // Find most urgent expiring coupon across ALL spendable coupons
  let urgentCoupon: WidgetCouponPayload | null = null;
  let minDays: number | null = null;

  for (const coupon of spendable) {
    if (!coupon.expiration) continue;
    const days = daysUntilExpiration(coupon.expiration);
    if (days !== null && days >= 0 && days <= 7) {
      if (minDays === null || days < minDays) {
        minDays = days;
        urgentCoupon = {
          id: coupon.id,
          publicId: coupon.public_id,
          company: coupon.company,
          code: coupon.code,
          remainingValue: couponRemainingValue(coupon),
          expiration: coupon.expiration ?? null,
          logoFile: null,
          cardExp: coupon.card_exp ?? null,
          cvv: coupon.cvv ?? null,
        };
      }
    }
  }

  let mascotTier = 1;
  if (minDays !== null) {
    if (minDays <= 0) mascotTier = 5;
    else if (minDays === 1) mascotTier = 4;
    else if (minDays <= 4) mascotTier = 3;
    else if (minDays <= 7) mascotTier = 2;
  }

  // Ensure urgent coupon is in the coupons list so its logo gets prepared
  const allCoupons = [...selected];
  if (urgentCoupon && !allCoupons.some((c) => c.id === urgentCoupon!.id)) {
    allCoupons.push(urgentCoupon);
  }

  return {
    updatedAt: new Date().toISOString(),
    activeCouponsCount: spendable.length,
    oneTimeCouponsCount: spendable.filter((coupon) => coupon.is_one_time === true).length,
    totalRemainingValue: totalRemainingValue(coupons),
    coupons: allCoupons,
    urgentCoupon,
    urgentDaysRemaining: minDays,
    mascotTier,
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
