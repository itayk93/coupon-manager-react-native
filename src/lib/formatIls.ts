/**
 * Currency formatting for the app's wallet figures.
 *
 * The product convention is a leading shekel sign (`₪ 1,000.00`).
 */
export function formatIls(value: number): string {
  return `₪ ${formatIlsNumber(value)}`;
}

export function formatIlsNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${fraction}`;
}
