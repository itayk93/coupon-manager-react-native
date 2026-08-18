/**
 * Currency formatting for the app's wallet figures.
 *
 * Shekel sign sits to the LEFT of the number (`₪1,000.00`) and every thousand
 * group is separated by a comma, per the dashboard/statistics design.
 */
export function formatIls(value: number): string {
  const sign = value < 0 ? "-" : "";
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}₪${grouped}.${fraction}`;
}
