/**
 * Deriving `coupon.used_value` from the usage/transaction ledger.
 *
 * The history screen and the "delete a record" recalculation used to read the
 * same rows in two different ways, and the recalculation was the wrong one: it
 * summed `Math.abs()` of every amount across both tables, so a loading row
 * stored as a negative usage counted as spending, and a usage mirrored in both
 * tables counted twice. Any coupon that had a record deleted was pushed to
 * `Math.min(value, ...)` and silently flipped to "נוצל".
 *
 * Map rows through `ledgerAmount*` and feed the result to `usedValueFromLedger`
 * so both screens agree on what was spent.
 */

/**
 * The daily Multipass flow writes each scraped transaction twice: once into
 * `coupon_transaction` and once into `coupon_usage` as an audit row. The audit
 * rows are hidden from the history, and they must be left out of the balance
 * too or their amount is counted twice.
 */
const HIDDEN_AUTO_USAGE_DETAILS = new Set(["עדכון אוטומטי via Multipass daily flow"]);

export function isHiddenLedgerRow(details: string): boolean {
  const normalized = details.trim();
  if (!normalized) return false;
  if (HIDDEN_AUTO_USAGE_DETAILS.has(normalized)) return true;
  return normalized.toLowerCase().includes("multipass daily flow");
}

/** A usage row is always spending, whatever sign the amount was stored with. */
export function ledgerAmountFromUsage(usedAmount: number | null): number {
  return -Math.abs(usedAmount || 0);
}

/**
 * A transaction row carries both directions, and either column may hold the
 * other one's sign: a loading of ₪100 shows up as `recharge_amount = 100` or as
 * `usage_amount = -100`. Subtracting keeps both spellings equivalent.
 */
export function ledgerAmountFromTransaction(
  rechargeAmount: number | null,
  usageAmount: number | null
): number {
  return (rechargeAmount || 0) - (usageAmount || 0);
}

/**
 * How much of `value` the ledger says was spent.
 *
 * A ledger that carries its own loading rows (credits) is complete: the balance
 * is credits minus debits, and the loadings already add up to the coupon's
 * value, so spending is `value - balance`. A ledger of usages only is not
 * complete — those rows are spending against the coupon's value directly, and
 * subtracting the missing loading would zero the coupon out.
 */
export function usedValueFromLedger(value: number, amounts: number[]): number {
  const credits = amounts.reduce((sum, a) => (a > 0 ? sum + a : sum), 0);
  const debits = amounts.reduce((sum, a) => (a < 0 ? sum - a : sum), 0);
  const used = credits > 0 ? value - (credits - debits) : debits;
  return Math.min(value, Math.max(0, used));
}
