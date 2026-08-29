import type { DecryptedCoupon } from "@/hooks/useCoupons";

export const normalizeCouponCode = (value: string) =>
  value.normalize("NFKC").toLocaleUpperCase("he-IL").replace(/[^\p{L}\p{N}]/gu, "");

export type CouponCodeMatch =
  | { kind: "exact"; coupon: DecryptedCoupon }
  | { kind: "partial"; coupon: DecryptedCoupon }
  | { kind: "ambiguous"; coupons: DecryptedCoupon[] }
  | { kind: "none" };

export function matchCouponCode(code: string | null, coupons: DecryptedCoupon[]): CouponCodeMatch {
  const needle = normalizeCouponCode(code || "");
  if (!needle) return { kind: "none" };
  const active = coupons.filter((coupon) => coupon.status !== "נוצל");
  const exact = active.filter((coupon) => normalizeCouponCode(coupon.code) === needle);
  if (exact.length === 1) return { kind: "exact", coupon: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", coupons: exact };
  if (needle.length < 4) return { kind: "none" };
  const partial = active.filter((coupon) => {
    const candidate = normalizeCouponCode(coupon.code);
    return candidate.endsWith(needle) || needle.endsWith(candidate);
  });
  if (partial.length === 1) return { kind: "partial", coupon: partial[0] };
  if (partial.length > 1) return { kind: "ambiguous", coupons: partial };
  return { kind: "none" };
}
