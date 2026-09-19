/**
 * How hard it is to pull past the end of a page.
 *
 * Separated from the gesture because this curve is the whole feel of it and
 * nothing else about it can be checked without a finger. See `PullUpAction`.
 *
 * The rule the curve has to satisfy: the first points of travel come almost
 * free, and it gets heavier the further you go. That is what makes crossing the
 * line something you do deliberately rather than something the tail of a brisk
 * scroll does for you — a tab that tracked the finger one to one would arm
 * itself every time someone flicked to the bottom of the page.
 *
 * A square root gives exactly that shape. Half the finger travel has already
 * spent 71% of the tab's, so the last third of the pull is the third that costs
 * something, and that is the third where the user is deciding.
 */

/** Finger travel past the end of the page, in points, before the action arms. */
export const FINGER_TO_ARM = 120;
/** How far the tab has risen at that moment. */
export const TRAVEL_AT_ARM = 72;
/** A hard ceiling, so leaning on the gesture does not drag the tab up the
 *  screen — past the line, more pull buys almost nothing, which is itself a
 *  signal that there is nothing further to reach. */
export const MAX_TRAVEL = 88;

/** Tab travel, in points, for a finger this far past the end of the page. */
export function pullTravel(past: number): number {
  "worklet";
  if (!(past > 0)) return 0;
  return Math.min(MAX_TRAVEL, TRAVEL_AT_ARM * Math.sqrt(past / FINGER_TO_ARM));
}

/** True once letting go would fire the action. */
export function pullArmed(travel: number): boolean {
  "worklet";
  return travel >= TRAVEL_AT_ARM;
}
