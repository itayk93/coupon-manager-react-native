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

/**
 * How close the deadline is, as one name the whole app can agree on.
 *
 * The same four steps as `expiryEmphasis`, named for what they mean rather
 * than for how loud they are, because the face and the motion have to move
 * together: it is one escalation, not two that happen to line up.
 */
export type ExpiryLevel = "none" | "watch" | "worry" | "alarm";

export function expiryLevel(days: number | null | undefined): ExpiryLevel {
  if (typeof days !== "number" || Number.isNaN(days) || days > WATCH_MAX_DAYS) return "none";
  if (days <= BREATHING_MAX_DAYS) return "alarm";
  if (days <= PEEK_MAX_DAYS) return "worry";
  return "watch";
}

/** Beyond this many days a coupon is not worth a worried face at all. */
export const WATCH_MAX_DAYS = 7;

/**
 * What Kuponi does at each level.
 *
 * Three drawn faces, one per rung. `speed` briefly carried this escalation on
 * its own — one worried loop played harder as the date closed — while the
 * artwork was still missing. It is back to 1 everywhere now that the faces
 * exist: keeping both would escalate twice and read as panic.
 *
 * The prop stays because it is the honest fallback if a future state ever
 * ships before its artwork does.
 */
export const EXPIRY_PERFORMANCE: Record<
  ExpiryLevel,
  { state: "calm" | "concerned" | "worried" | "alarmed"; speed: number }
> = {
  none: { state: "calm", speed: 1 },
  watch: { state: "concerned", speed: 1 },
  worry: { state: "worried", speed: 1 },
  alarm: { state: "alarmed", speed: 1 },
};

/** How long is left, in words. One phrasing everywhere, so two screens looking
 *  at the same coupon can never word the same deadline differently. */
export function daysPhrase(days: number): string {
  if (days <= 0) return "פג היום";
  if (days === 1) return "פג מחר";
  if (days === 2) return "פג בעוד יומיים";
  return `פג בעוד ${days} ימים`;
}
