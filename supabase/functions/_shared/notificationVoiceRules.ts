/**
 * The rules that decide whether a generated notification may be sent.
 *
 * Split out of notificationVoice.ts, which reaches for Deno and the network, so
 * that the checks themselves stay plain TypeScript and can be tested from the
 * app's own test run — exactly like appLinks.ts. These are the only thing
 * standing between a model and someone's money, so they are worth testing on
 * every commit rather than only in production.
 */

export const MAX_TITLE = 42;
export const MAX_BODY = 190;

/**
 * Digits the model is allowed to use — anything else is invented.
 *
 * Walks nested values because some kinds carry a list: the expiry message hands
 * over a line per coupon, and every amount inside those lines is a fact.
 */
function allowedNumbers(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'number') found.push(...String(value).match(/\d+/g) || []);
  else if (typeof value === 'string') found.push(...value.match(/\d+/g) || []);
  else if (Array.isArray(value)) value.forEach((item) => allowedNumbers(item, found));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => allowedNumbers(item, found));
  }
  return found;
}

/**
 * Whether a generated line is safe to send.
 *
 * The checks are all about the same failure: a fluent sentence that is not
 * true. A digit run that appears nowhere in the facts is the tell — a model
 * that rounded 869.80 to "כמעט 900" has changed what the app is telling
 * someone about their own money.
 */
export function isUsable(
  candidate: { title?: unknown; body?: unknown },
  payload: Record<string, unknown>,
): candidate is { title: string; body: string } {
  const { title, body } = candidate;
  if (typeof title !== 'string' || typeof body !== 'string') return false;
  if (!title.trim() || !body.trim()) return false;
  if (title.length > MAX_TITLE || body.length > MAX_BODY) return false;

  // Hebrew has to be the language, not a garnish.
  if (!/[֐-׿]/.test(body)) return false;

  // The shekel sign is what we asked it not to write.
  if (body.includes('₪') || title.includes('₪')) return false;

  // Latin brand names are allowed, English glue words are not. A model once
  // wrote "קופון מאסטר from Wolt", which made the entire iOS banner resolve
  // left-to-right despite the Hebrew around it.
  if (/\b(?:from|with|by|at|for|of)\b/i.test(`${title} ${body}`)) return false;

  const permitted = new Set(allowedNumbers(payload));
  for (const run of `${title} ${body}`.match(/\d+/g) || []) {
    if (!permitted.has(run)) return false;
  }
  return true;
}
