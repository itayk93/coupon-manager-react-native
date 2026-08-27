/**
 * What a referral code may look like, agreed between the app that builds the
 * link and the function that redeems it.
 *
 * Shared rather than duplicated because the two sides disagreeing is the kind
 * of bug that shows up as "the link didn't work for my friend" weeks later,
 * with nothing in any log.
 *
 * Deliberately free of Deno and React Native APIs: both sides import this file.
 */

/**
 * The alphabet personal codes are generated from, minus every pair that looks
 * alike when read off a phone screen: 0/O, 1/I/L, 5/S, 8/B.
 */
export const REFERRAL_CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY2346799";

/** Long enough for a partner's name ("ELIOR"), short enough to dictate. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 24;

/**
 * A typed or pasted code, reduced to the one form the database compares.
 *
 * Returns null for anything that cannot be a code, so a caller can treat "no
 * code" and "nonsense" identically — both mean there is nothing to claim.
 */
export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return null;
  // Letters and digits only. A code arrives from a URL path, and anything that
  // is not alphanumeric there is either a mangled link or someone probing.
  if (!/^[A-Z0-9]+$/.test(trimmed)) return null;
  return trimmed;
}

/** The link that goes in a share sheet, an email, or a WhatsApp message. */
export function referralUrl(base: string, code: string): string {
  return `${base.replace(/\/+$/, "")}/r/${encodeURIComponent(code)}`;
}
