import { matchesCouponSearch, type SearchableCoupon } from "./couponSearch";

/**
 * The rows a coupon picker shows: the first `limit` coupons matching the
 * search, plus the selected one wherever it sits, so a choice never vanishes
 * from view. `total` is how many matched, for a "showing N of M" hint.
 */
export function pickerCoupons<T extends SearchableCoupon & { id: number }>(
  coupons: readonly T[],
  query: string,
  selectedId: number | null,
  limit: number
): { shown: T[]; total: number } {
  const matches = coupons.filter((c) => matchesCouponSearch(c, query));
  const shown = matches.slice(0, limit);
  const selected = selectedId === null ? undefined : coupons.find((c) => c.id === selectedId);
  if (selected && !shown.includes(selected)) shown.unshift(selected);
  return { shown, total: matches.length };
}
