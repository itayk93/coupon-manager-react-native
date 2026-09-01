/** Removes formatting characters commonly inserted into RTL messages. */
function searchableText(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/&#x20;|&#32;|&nbsp;/gi, " ");
}

/** Deterministic fields that coupon messages usually label explicitly. */
export function extractCardExpiry(text: string): string | null {
  const match = searchableText(text).match(
    /(?:תוקף|תאריך\s+תוקף|expiry|exp(?:iration)?)\s*[:：-]?\s*(0[1-9]|1[0-2])\s*\/\s*(\d{2})\b/i
  );
  return match ? `${match[1]}/${match[2]}` : null;
}

export function extractVerificationCode(text: string): string | null {
  const match = searchableText(text).match(
    /(?:קוד\s*(?:אימות|בטחון|ביטחון)|CVV|CVC)\s*[:：-]?\s*([A-Z0-9]{3,4})\b/i
  );
  return match?.[1] || null;
}

export function extractVoucherCode(text: string): string | null {
  return searchableText(text).match(/\b(?:\d{7,12}-\d{4}|\d{4}(?:-\d{4}){3})\b/)?.[0] || null;
}

/** Converts MM/YY card expiry to the coupon's last valid calendar day. */
export function cardExpiryToExpiration(cardExpiry: string): string | null {
  const match = cardExpiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${match[1]}-${String(lastDay).padStart(2, "0")}`;
}

/** Picks the merchant-list URL, never a later balance-check URL. */
export function extractRedemptionUrl(text: string): string | null {
  const normalized = searchableText(text);
  const labeled = normalized.match(
    /(?:לרשימת\s+(?:העסקים|בתי\s+העסק)|למימוש\s+(?:מקוון|אונליין))[^\n]*\n\s*(?:\[[^\]]*\]\()?\s*(https?:\/\/[^\s)\]]+)/i
  );
  return labeled?.[1]?.replace(/[.,]+$/, "") || null;
}

/** Converts "תוקף השובר: 5 שנים" to an absolute date from import day. */
export function extractRelativeExpiration(text: string, now = new Date()): string | null {
  const match = searchableText(text).match(
    /תוקף\s+(?:ה?שובר|ה?קופון)\s*[:：-]?\s*(\d{1,2})\s*(?:שנים|שנה)(?:\s|[.,]|$)/
  );
  if (!match) return null;
  const years = Number(match[1]);
  if (years < 1 || years > 20) return null;

  const result = new Date(Date.UTC(
    now.getUTCFullYear() + years,
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  return result.toISOString().slice(0, 10);
}

/**
 * Reads an explicit full coupon-expiration date. MM/YY values belong to the
 * prepaid card and are handled by extractCardExpiry instead.
 */
export function extractExpiration(text: string): string | null {
  const match = searchableText(text).match(
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
