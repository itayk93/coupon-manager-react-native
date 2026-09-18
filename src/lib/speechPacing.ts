/**
 * How long Kuponi takes to say a line, and how much of it has left his mouth.
 *
 * Kept here rather than in the bubble for the reason `homeHero.ts` and
 * `expiryUrgency.ts` are here: the timing is what ties his talking loop to the
 * words, so the two must be read off one number and not guessed at twice.
 *
 * The rate is the subtitle industry's comfortable reading speed, which is
 * around 21 characters per second, with adaptive systems running 10–25. Kuponi
 * sits under the middle of that: a line of his is short and he is a character
 * speaking, not a subtitle track keeping up with someone else's audio.
 *
 * The bounds are what keep him from reading as a machine. Under the floor the
 * reveal is over before the eye finds the bubble and the talking loop reads as
 * a flicker; over the ceiling he is still mouthing at a line the reader
 * finished long ago, and a mascot loop that outstays its welcome is the thing
 * `expiryUrgency.ts` refuses to do with the expiry glow.
 */

/** Characters a second. */
export const SPEECH_CPS = 18;
/** No line is over faster than this. */
export const MIN_SPEECH_MS = 900;
/** No line holds him in the talking loop longer than this. */
export const MAX_SPEECH_MS = 3500;

/** How long the line takes to say, in milliseconds. */
export function speechDuration(text: string): number {
  const natural = (text.trim().length / SPEECH_CPS) * 1000;
  return Math.round(Math.min(MAX_SPEECH_MS, Math.max(MIN_SPEECH_MS, natural)));
}

/**
 * The part of the line that is out by `progress`, a fraction of its duration.
 *
 * Whole words only. A per-character reveal looks right in English and falls
 * apart in ours: "55.00 ₪ עומדים לפוג" is bidirectional text, and a half-arrived
 * number reorders itself on screen as its digits land. A word is the smallest
 * unit that never does that, and it is closer to how speech arrives anyway.
 *
 * The first word is already out when he starts, so the bubble never opens
 * empty, and words after it are weighted by their length — a long word takes
 * longer to say than a short one.
 */
export function spokenSoFar(text: string, progress: number): string {
  if (progress >= 1) return text;
  const words = text.split(" ");
  if (words.length <= 1) return text;

  const budget = text.length * Math.max(0, progress);
  let spoken = 1;
  let said = words[0].length;
  while (spoken < words.length && said + 1 + words[spoken].length <= budget) {
    said += 1 + words[spoken].length;
    spoken += 1;
  }
  return words.slice(0, spoken).join(" ");
}
