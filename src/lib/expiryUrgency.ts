/**
 * How loudly the expiry banner should behave, given the nearest expiry.
 *
 * The banner sits on the dashboard every single day, so the motion budget has
 * to be spent where it buys something. Apps that pulse a warning forever teach
 * people to stop seeing it — Apple Wallet uses no motion at all, Duolingo
 * plays one 600ms reaction on entry and then holds still. Three steps:
 *
 * - `static`   — more than 3 days out. Nothing moves. A colour and a date.
 * - `peek`     — 2 to 3 days. The mascot leans in once and a highlight sweeps
 *                the banner once, then everything rests.
 * - `breathing`— under 48 hours, meaning today or tomorrow. Here the deadline
 *                is real, so a slow loop earns its keep.
 *
 * Days are whole calendar days, the way `ExpiringCouponsBanner` counts them:
 * 0 is "expires today", 1 is "expires tomorrow". So "under 48 hours" is
 * `days <= 1`, not a clock comparison — a coupon expiring tomorrow at 23:59 is
 * still tomorrow's problem in every way that matters to the person reading it.
 */

export type ExpiryEmphasis = "static" | "peek" | "breathing";

/** Above this many days the banner does not move at all. */
export const PEEK_MAX_DAYS = 3;
/** At or below this, the glow loops instead of passing once. */
export const BREATHING_MAX_DAYS = 1;

export function expiryEmphasis(days: number | null | undefined): ExpiryEmphasis {
  if (typeof days !== "number" || Number.isNaN(days)) return "static";
  if (days <= BREATHING_MAX_DAYS) return "breathing";
  if (days <= PEEK_MAX_DAYS) return "peek";
  return "static";
}
