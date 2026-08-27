import {
  normalizeReferralCode,
  referralUrl,
} from "../../supabase/functions/_shared/referralCodes";

export { normalizeReferralCode, referralUrl };

/**
 * The rules a referral link lives by on the device, kept free of React Native
 * and storage APIs so they can be tested directly.
 *
 * The one thing worth being strict about is time. A code sits on the phone
 * between the moment someone taps a friend's link and the moment they finish
 * registering — a gap of seconds for most people, and days for anyone who
 * installed the app and got distracted. Past that it is not evidence of
 * anything: a stale code would hand a partner a user who arrived on their own
 * weeks later, and the server refuses it anyway.
 */
export const PENDING_REFERRAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type PendingReferral = {
  code: string;
  savedAt: number;
};

export function isPendingReferralFresh(
  pending: PendingReferral | null,
  now: number,
  ttlMs = PENDING_REFERRAL_TTL_MS
): boolean {
  if (!pending) return false;
  // A clock that moved backwards (a timezone change, a manual correction)
  // should not silently extend a code's life, so the future is stale too.
  if (pending.savedAt > now) return false;
  return now - pending.savedAt < ttlMs;
}

/**
 * The code inside `/r/ABC123`, wherever the link arrived from — a deep link,
 * a pasted URL, or the router handing over a route param.
 */
export function referralCodeFromPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/\/r\/([^/?#]+)/i);
  return normalizeReferralCode(match ? decodeURIComponent(match[1]) : value);
}

/**
 * What a person sends their friend. Written as one line about the app rather
 * than about the reward: the reward is between us and the partner, and a
 * message that leads with it reads like a scheme.
 */
export function referralShareMessage(base: string, code: string): string {
  return `אני מנהל את הקופונים שלי בקופון מאסטר. אפשר להצטרף כאן: ${referralUrl(base, code)}`;
}
