/** Deterministic fields that coupon messages usually label explicitly. */
export function extractCardExpiry(text: string): string | null {
  const match = text.match(
    /(?:תוקף|תאריך\s+תוקף|expiry|exp(?:iration)?)\s*[:：-]?\s*(0[1-9]|1[0-2])\s*\/\s*(\d{2})\b/i
  );
  return match ? `${match[1]}/${match[2]}` : null;
}

export function extractVerificationCode(text: string): string | null {
  const match = text.match(
    /(?:קוד\s+(?:אימות|בטחון|ביטחון)|CVV|CVC)\s*[:：-]?\s*([A-Z0-9]{3,4})\b/i
  );
  return match?.[1] || null;
}

export function extractVoucherCode(text: string): string | null {
  return text.match(/\b(?:\d{7,12}-\d{4}|\d{4}(?:-\d{4}){3})\b/)?.[0] || null;
}

/**
 * Reads an explicit full coupon-expiration date. MM/YY values belong to the
 * prepaid card and are handled by extractCardExpiry instead.
 */
export function extractExpiration(text: string): string | null {
  const match = text.match(
    /(?:בתוקף|תוקף(?:\s+(?:ה?שובר|ה?קופון|ה?מתנה))?)\s*(?:עד|ל)?\s*(?:לתאריך)?\s*[:：-]?\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}
