import type { DecryptedCoupon } from "@/hooks/useCoupons";

export const normalizeCouponCode = (value: string) =>
  value.normalize("NFKC").toLocaleUpperCase("he-IL").replace(/[^\p{L}\p{N}]/gu, "");

function isSingleOcrError(left: string, right: string): boolean {
  if (left.length !== right.length || left.length < 8) return false;

  const mismatches: number[] = [];
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) mismatches.push(index);
    if (mismatches.length > 2) return false;
  }

  if (mismatches.length === 1) return true;
  if (mismatches.length !== 2) return false;

  const [first, second] = mismatches;
  return second === first + 1
    && left[first] === right[second]
    && left[second] === right[first];
}

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
    return candidate.endsWith(needle)
      || needle.endsWith(candidate)
      || isSingleOcrError(candidate, needle);
  });
  if (partial.length === 1) return { kind: "partial", coupon: partial[0] };
  if (partial.length > 1) return { kind: "ambiguous", coupons: partial };
  return { kind: "none" };
}
