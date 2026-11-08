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

