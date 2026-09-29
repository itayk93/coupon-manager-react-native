/**
 * How hard it is to pull past the end of a page.
 *
 * Separated from the gesture because this curve is the whole feel of it and
 * nothing else about it can be checked without a finger. See `PullUpAction`.
 *
 * Up to the line the tab tracks the finger one to one: every point of pull is
 * a point of tab, so the user can see the action coming and never has to guess
 * how much further to go. It used to be a square root over 120pt, and in
 * practice nobody reached the line — iOS's own bounce already eats part of the
 * pull, and the curve was heaviest exactly where the user was trying to finish.
 *
 * Accidents are guarded elsewhere, not by weight: the action fires only on
 * release while armed, so the tail of a flick (finger already up, momentum
 * carrying the page) can never set it off.
 *
 * Past the line the resistance kicks in, so leaning on it does not drag the tab
 * up the screen.
 */

/** Finger travel past the end of the page, in points, before the action arms. */
export const FINGER_TO_ARM = 60;
/** How far the tab has risen at that moment — the tab's own height, so armed
 *  is exactly "fully out". */
export const TRAVEL_AT_ARM = 56;
/** A hard ceiling, so leaning on the gesture does not drag the tab up the
 *  screen. */
export const MAX_TRAVEL = 72;
/** Once armed, the pull has to drop this far back before it disarms, so a
 *  finger wobbling on the line does not flicker the state (and the haptic). */
export const DISARM_AT = TRAVEL_AT_ARM * 0.8;

/** Tab travel, in points, for a finger this far past the end of the page. */
export function pullTravel(past: number): number {
  "worklet";
  if (!(past > 0)) return 0;
  if (past <= FINGER_TO_ARM) return (past / FINGER_TO_ARM) * TRAVEL_AT_ARM;
  // Rubber band past the line: approaches MAX_TRAVEL, never reaches past it.
  const over = past - FINGER_TO_ARM;
  const room = MAX_TRAVEL - TRAVEL_AT_ARM;
  return TRAVEL_AT_ARM + room * (1 - Math.exp(-over / 40));
}

/** Whether letting go now would fire the action, given whether it already would. */
export function pullArmed(travel: number, wasArmed = false): boolean {
  "worklet";
  return travel >= (wasArmed ? DISARM_AT : TRAVEL_AT_ARM);
}
