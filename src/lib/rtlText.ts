// One Hebrew sentence, laid out correctly wherever it lands.
//
// Notification banners on iOS, Android and PWA give no layout control: the OS
// runs the Unicode bidi algorithm over the raw string. A leading RTL mark makes
// the paragraph Hebrew, but it does not stop a Latin brand ("Wolt"), an amount
// ("10.00") and the punctuation between them from being merged into one LTR run
// and reordered against each other. Each such run gets its own isolate.
//
// Mirrored by supabase/functions/_shared/rtlText.ts — an edge function cannot
// import from src/.

const RLM = '\u200F';
const LRI = '\u2066';
const PDI = '\u2069';

/** Latin letters, digits and the shekel sign, plus punctuation held between them. */
const LTR_RUN = /[A-Za-z0-9₪](?:[A-Za-z0-9₪.,:'’&+\-\/\u00A0 ]*[A-Za-z0-9₪])?/g;

/** Marks already in the text, so re-wrapping is safe. */
const EXISTING_MARKS = /[\u200E\u200F\u2066-\u2069]/g;

export function rtlText(text: string): string {
  if (!text) return text;
  const bare = text.replace(EXISTING_MARKS, '');
  return `${RLM}${bare.replace(LTR_RUN, (run) => `${LRI}${run}${PDI}`)}`;
}
