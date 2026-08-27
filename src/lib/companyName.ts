/**
 * Company name grouping.
 *
 * Coupon rows store `company` as free text, so `GoodPharm`, `goodpharm` and
 * `GoodPharm ` have opened three dashboard cards for one brand. A grouping key
 * that folds case and whitespace lets the dashboard and the coupon list share
 * one identity without rewriting what the user originally typed.
 */

/** Stable identity for grouping: trimmed, lower-cased, whitespace-collapsed. */
export function companyKey(name: string | null | undefined): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Group coupons by company while keeping the display name the user typed.
 * Returns entries ordered by first appearance in the input list.
 */
export function groupCouponsByCompany<T extends { company?: string | null }>(
  coupons: T[],
): Array<{ company: string; items: T[] }> {
  const byKey = new Map<string, { company: string; items: T[] }>();
  for (const coupon of coupons) {
    const key = companyKey(coupon.company);
    const entry = byKey.get(key);
    if (entry) {
      entry.items.push(coupon);
    } else {
      byKey.set(key, {
        company: (coupon.company || "ללא חברה").trim(),
        items: [coupon],
      });
    }
  }
  return Array.from(byKey.values());
}
