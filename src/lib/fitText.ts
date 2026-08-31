/**
 * Choosing a font size that makes a single line fit, instead of asking the
 * platform to do it.
 *
 * `adjustsFontSizeToFit` is an iOS feature. react-native-web does not
 * implement it at all and Android honours it inconsistently, so a headline
 * that overflowed came out truncated with an ellipsis on exactly the devices
 * that could least afford to lose the words — the coupon's own name.
 *
 * The estimate is deliberately crude: Hebrew and Latin glyphs in Heebo average
 * a little over half the type size in width, so a line of `characters` needs
 * roughly `characters * WIDTH_PER_CHARACTER * size` points. Solving for size
 * and clamping gives a number that is right within a character or two, which
 * is all a strip of text needs. Anything more exact would mean measuring the
 * text twice per render.
 */

/**
 * Mean advance width of a glyph as a fraction of the font size, measured off
 * the real thing rather than guessed: the 31-character headline
 * "הקופון שלך בVANS פג בעוד 7 ימים" in Heebo Bold inks 136pt at 9pt type,
 * which is 0.487 per character. 0.5 rounds that up so a headline with wider
 * letters than average still fits rather than overflowing by a hair.
 */
const WIDTH_PER_CHARACTER = 0.5;

export type FitOptions = {
  /** The size to use when everything fits. */
  max?: number;
  /** Never go below this: past it the line is unreadable and truncation is kinder. */
  min?: number;
};

export function fitFontSize(
  characters: number,
  availableWidth: number,
  { max = 13, min = 9 }: FitOptions = {},
): number {
  // Before the first layout the width is unknown; the full size is the right
  // guess, and the next render corrects it.
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return max;
  if (!Number.isFinite(characters) || characters <= 0) return max;

  const fits = availableWidth / (characters * WIDTH_PER_CHARACTER);
  // Half-point steps: finer than that is invisible and churns the layout.
  const stepped = Math.floor(fits * 2) / 2;
  return Math.min(max, Math.max(min, stepped));
}
