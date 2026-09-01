/**
 * Company name grouping.
 *
 * Coupon rows store `company` as free text, so `GoodPharm`, `goodpharm` and
 * `GoodPharm ` have opened three dashboard cards for one brand. A grouping key
 * that folds case and whitespace lets the dashboard and the coupon list share
 * one identity without rewriting what the user originally typed.
 */

const COMPANY_ALIASES: Record<string, string> = {
  "גוד פארם": "goodpharm",
  "אקסטרה": "xtra",
  "משלוחה ארצי": "משלוחה",
};

/** Stable identity for grouping: punctuation, case, whitespace and known aliases. */
export function companyKey(name: string | null | undefined): string {
  const normalized = (name || "")
    .trim()
    .toLocaleLowerCase("he-IL")
    .replace(/["'׳״.,()\-]/g, " ")
    .replace(/\s+/g, " ");
  return COMPANY_ALIASES[normalized] || normalized;
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
