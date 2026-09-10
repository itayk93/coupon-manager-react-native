import { expiringWidgetCoupons } from "./widgetExpiry";
import { loadWidgetDebugOverride } from "./widgetDebugOverride";
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
export function buildWidgetPayload(coupons: DecryptedCoupon[]): WidgetPayload {
  const spendable = coupons.filter(isSpendableCoupon);

  const chosen = widgetSelection(spendable).slice(0, MAX_WIDGET_COUPONS);

  const selected: WidgetCouponPayload[] = chosen.map((coupon) => {
    const remaining = couponRemainingValue(coupon);
    return {
      id: coupon.id,
      publicId: coupon.public_id ?? null,
      company: coupon.company || "קופון",
      code: coupon.code || "",
      remainingValue: Number.isFinite(remaining) ? remaining : 0,
      expiration: coupon.expiration ?? null,
      logoFile: null,
      cardExp: coupon.card_exp ?? null,
      cvv: coupon.cvv ?? null,
    };
  });

  // Every spendable coupon expiring within the week, soonest first. Drives the
  // mascot scene and the "show me what's expiring" tap target.
  const expiring = expiringWidgetCoupons(spendable);

  const minDays = expiring.length ? expiring[0].days : null;
  const urgentCoupon: WidgetCouponPayload | null = expiring.length
    ? {
        id: expiring[0].coupon.id,
        publicId: expiring[0].coupon.public_id ?? null,
        company: expiring[0].coupon.company || "קופון",
        code: expiring[0].coupon.code || "",
        remainingValue: Number.isFinite(couponRemainingValue(expiring[0].coupon))
          ? couponRemainingValue(expiring[0].coupon)
          : 0,
        expiration: expiring[0].coupon.expiration ?? null,
        logoFile: null,
        cardExp: expiring[0].coupon.card_exp ?? null,
        cvv: expiring[0].coupon.cvv ?? null,
      }
    : null;

  // Tapping the widget opens the coupons list filtered to exactly these.
  // Swift decodes this as [String]. Never let an absent legacy public_id
  // serialize as null inside the array, because one null would invalidate the
  // complete widget payload and make the native widget fall back to zeroes.
  const expiringIds = expiring
    .map((e) => e.coupon.public_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  let mascotTier = 1;
  if (minDays !== null) {
    if (minDays <= 0) mascotTier = 5;
    else if (minDays === 1) mascotTier = 4;
    else if (minDays <= 4) mascotTier = 3;
    else if (minDays <= 7) mascotTier = 2;
  }

  const rawTotal = totalRemainingValue(coupons);
  const totalValue = Number.isFinite(rawTotal) ? rawTotal : 0;

  // Only the coupons the user actually chose (max 4). An expiring coupon is
  // never auto-added here — the mascot scene already handles urgency, and the
  // medium/large lists must show exactly what was picked.
  return {
    updatedAt: new Date().toISOString(),
    activeCouponsCount: spendable.length,
    oneTimeCouponsCount: spendable.filter((coupon) => coupon.is_one_time === true).length,
    totalRemainingValue: totalValue,
    coupons: selected,
    urgentCoupon,
    urgentDaysRemaining: minDays,
    mascotTier,
    expiringCount: expiring.length,
    expiringIds,
    celebration: null,
  };
}

/** Scene labels for the admin debug switcher, index = state number (1..9). */
export const WIDGET_DEBUG_STATES: { state: number; label: string; days: number | null }[] = [
  { state: 1, label: "רגוע · 8+ ימים", days: null },
  { state: 2, label: "שבוע · 7 ימים", days: 7 },
  { state: 3, label: "6 ימים", days: 6 },
  { state: 4, label: "5 ימים", days: 5 },
  { state: 5, label: "4 ימים", days: 4 },
  { state: 6, label: "3 ימים", days: 3 },
  { state: 7, label: "יומיים", days: 2 },
  { state: 8, label: "מחר", days: 1 },
  { state: 9, label: "היום · פג", days: 0 },
];

/**
 * DEBUG (admin only). Forces the home-screen widget into one mascot scene so it
 * can be eyeballed on a real device without waiting for a coupon to actually
 * near its expiry. The real payload is restored on the next coupon change, or
 * immediately via `syncWidget`.
 */
export function previewWidgetState(stateNumber: number, coupons: DecryptedCoupon[]): void {
  const base = buildWidgetPayload(coupons);
  const found = WIDGET_DEBUG_STATES.find((s) => s.state === stateNumber);
  const days = found ? found.days : null;

  const sample: WidgetCouponPayload =
    base.coupons[0] ?? {
      id: -1,
      publicId: null as unknown as string,
      company: "רמי לוי",
      code: "1234567890123",
      remainingValue: 80,
      expiration: null,
      logoFile: null,
      cardExp: null,
      cvv: null,
    };

  const expiration =
    days === null ? null : new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  setWidgetData({
    ...base,
    celebration: null,
    urgentCoupon: days === null ? null : { ...sample, expiration },
    urgentDaysRemaining: days,
    expiringCount: days === null ? 0 : 1,
    expiringIds: days === null || !sample.publicId ? [] : [sample.publicId],
    mascotTier: days === null ? 1 : days <= 0 ? 5 : days === 1 ? 4 : days <= 4 ? 3 : 2,
  });
}

/** Celebration scenes the admin debug switcher can force. */
export const WIDGET_DEBUG_CELEBRATIONS: { kind: string; label: string }[] = [
  { kind: "anniversary", label: "🎂 יום שנה" },
];

/** DEBUG (admin only). Forces a celebration scene onto the small widget. */
export function previewWidgetCelebration(kind: string, coupons: DecryptedCoupon[]): void {
  const base = buildWidgetPayload(coupons);
  setWidgetData({
    ...base,
    celebration: kind,
    urgentCoupon: null,
    urgentDaysRemaining: null,
    expiringCount: 0,
    expiringIds: [],
    mascotTier: 1,
  });
}

/** Routes a stored debug token ("1".."9" or a celebration key) to its preview. */
export function applyWidgetDebugToken(token: string, coupons: DecryptedCoupon[]): void {
  if (/^\d+$/.test(token)) previewWidgetState(Number(token), coupons);
  else previewWidgetCelebration(token, coupons);
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
  // Admin debug: a forced state pins the widget until it is cleared, so real
  // coupon changes must not overwrite it.
  const override = await loadWidgetDebugOverride();
  if (override != null) {
    applyWidgetDebugToken(override, coupons);
    return;
  }

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
