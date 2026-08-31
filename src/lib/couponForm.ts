/**
 * The parts of the add/edit coupon form that are pure: which provider a company
 * implies, whether the fields are valid, and what row they turn into.
 *
 * These lived inside the screen component, where they could only be exercised
 * by rendering it. Out here they are ordinary functions with tests, which is
 * what makes the rest of the form safe to move.
 */

/**
 * Providers the balance scraper knows how to log into. Kept in sync with the
 * web form (`src/components/coupons/CouponForm.tsx`).
 */
export const AUTO_PROVIDERS = ["Multipass"] as const;
export type AutoProvider = (typeof AUTO_PROVIDERS)[number];

export function normalizeAutoProvider(
  value: string | null | undefined,
  allowAutoUpdater: boolean
): AutoProvider | null {
  if (!allowAutoUpdater) return null;
  return AUTO_PROVIDERS.includes(value as AutoProvider)
    ? (value as AutoProvider)
    : null;
}

export function getDefaultAutoProvider(
  company: string | null | undefined
): AutoProvider | null {
  const name = company?.trim().toLowerCase() || "";
  if (name.includes("multipass") || name.includes("מולטיפאס")) return "Multipass";
  if (name.includes("xtra") || name.includes("אקסטרה")) return "Multipass";
  return null;
}

/** Every field the form edits, as the strings the inputs actually hold. */
export type CouponFormFields = {
  company: string;
  code: string;
  value: string;
  cost: string;
  expiration: string;
  isOneTime: boolean;
  purpose: string;
  description: string;
  includeCardInfo: boolean;
  cvv: string;
  cardExp: string;
  redemptionUrl: string;
  autoProvider: AutoProvider | null;
};

export type CouponFormErrors = Record<string, string>;

/**
 * How a coupon code is stored. BuyMe / Multipass / Max print their codes in
 * dash-separated groups ("9376-1104-0711-1925") but the code that actually
 * redeems is the digits alone, so a purely numeric code is stored without its
 * dashes or spaces. A code with letters ("SUMMER-20") is left as typed —
 * there the dash may be part of the code.
 */
export function normalizeCouponCode(code: string): string {
  const trimmed = code.trim();
  if (/^[0-9\s-]+$/.test(trimmed)) return trimmed.replace(/[\s-]/g, "");
  return trimmed;
}

/**
 * Loose key for comparing two codes: every code matches its dashed and spaced
 * forms, case-insensitively. Used only to spot duplicates, never to store.
 */
export function couponCodeKey(code: string | null | undefined): string {
  return String(code ?? "").replace(/[\s-]/g, "").toLowerCase();
}

export type DuplicateCandidate = {
  code: string;
  company?: string | null;
  status?: string | null;
};

/**
 * Coupons the user already has whose code matches `code` once dashes and
 * spaces are ignored. An empty code never matches.
 */
export function findDuplicateCoupons<T extends DuplicateCandidate>(
  code: string,
  coupons: readonly T[]
): T[] {
  const key = couponCodeKey(code);
  if (!key) return [];
  return coupons.filter((coupon) => couponCodeKey(coupon.code) === key);
}

export function validateCouponForm(fields: CouponFormFields): CouponFormErrors {
  const errors: CouponFormErrors = {};
  if (!fields.company.trim()) errors.company = "יש לבחור או להזין חברה";
  if (!fields.code.trim()) errors.code = "קוד קופון הוא שדה חובה";
  if (
    !fields.value.trim() ||
    isNaN(Number(fields.value)) ||
    Number(fields.value) < 0
  ) {
    errors.value = "יש להזין שווי תקין בש״ח";
  }
  return errors;
}

/**
 * The columns an edit writes. A new coupon is this plus the two values that
 * only make sense once — `used_value` and `status`.
 *
 * `showAutoUsageUpdater` is passed rather than read from auth: the automatic
 * balance updater only runs for the maintainer's own account, and everyone
 * else must store `auto_download_details: null` no matter what the (hidden)
 * picker happens to hold.
 */
export function buildCouponPayload(
  fields: CouponFormFields,
  showAutoUsageUpdater: boolean
) {
  return {
    company: fields.company.trim(),
    code: normalizeCouponCode(fields.code),
    value: Number(fields.value) || 0,
    cost: Number(fields.cost) || 0,
    expiration: fields.expiration.trim() || null,
    is_one_time: fields.isOneTime,
    purpose: fields.purpose.trim() || null,
    description: fields.description.trim() || null,
    cvv: fields.includeCardInfo ? fields.cvv.trim() || null : null,
    card_exp: fields.includeCardInfo ? fields.cardExp.trim() || null : null,
    buyme_coupon_url: fields.redemptionUrl.trim() || null,
    auto_download_details: showAutoUsageUpdater ? fields.autoProvider : null,
    auto_update: showAutoUsageUpdater ? fields.autoProvider !== null : false,
  };
}
