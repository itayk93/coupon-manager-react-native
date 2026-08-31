/**
 * Currency formatting for the app's wallet figures.
 *
 * Product convention: shekel sign on the visual left of the number.
 */
export function formatIls(value: number): string {
  // LRI/PDI keep the currency run visually LTR inside surrounding Hebrew;
  // NBSP prevents the symbol from wrapping onto a separate line.
  return `\u2066₪\u00A0${formatIlsNumber(value)}\u2069`;
}

export function formatIlsNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${fraction}`;
}

/** Rounded, no agorot: "\u20aa 1,620". For dense stat tiles where the cents are noise. */
export function formatIlsCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const grouped = Math.round(Math.abs(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `\u2066\u20aa\u00a0${sign}${grouped}\u2069`;
}
