type SearchableCoupon = {
  company?: string | null;
  description?: string | null;
  code?: string | null;
};

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

// Coupon numbers are often pasted with spaces or dashes added by the issuer.
// Ignore formatting characters only for code matching; normal text search keeps
// its existing semantics.
function normalizedCouponCode(value: string): string {
  return normalizedText(value).replace(/[\s\-_./\\]+/g, "");
}

export function matchesCouponSearch(
  coupon: SearchableCoupon,
  search: string
): boolean {
  const term = normalizedText(search);
  if (!term) return true;

  if (normalizedText(coupon.company || "").includes(term)) return true;
  if (normalizedText(coupon.description || "").includes(term)) return true;

  const code = normalizedText(coupon.code || "");
  if (code.includes(term)) return true;

  const normalizedTerm = normalizedCouponCode(term);
  return Boolean(normalizedTerm) && normalizedCouponCode(code).includes(normalizedTerm);
}
