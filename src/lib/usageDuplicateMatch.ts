/**
 * Client-side mirror of the duplicate rule enforced server-side in
 * `record_coupon_usage_batch` (migration 20260830210140). Within one coupon, a
 * detected usage duplicates an existing ledger row when both match:
 *   - amount, rounded to agorot
 *   - timestamp, truncated to the minute
 *
 * The place deliberately plays no part. It used to, and OCR sank it: the same
 * branch came back as "ארקפה - מידטאון" from one screenshot and
 * "ארקפה - מיזטאון" from the next, so an identical 15₪ usage at 2026-08-23
 * 09:19 was inserted twice. A coupon cannot be spent at two places in the same
 * minute for the same amount, so amount + minute already identifies a usage —
 * and the place is the noisiest field in the chain.
 *
 * A detected row with no timestamp never matches: the server stamps those with
 * now(), so they cannot be the same event as an older ledger entry.
 *
 * Keeping this identical to the SQL means the modal flags exactly the rows the
 * server would silently skip — no false "already exists", no surprise skips.
 */

export type DuplicateCandidate = {
  amount: number;
  usedAt?: string | null;
};

export type ExistingUsageRow = {
  transaction_amount: number;
  timestamp?: string | null;
};

/** Minute bucket in absolute time — matches `date_trunc('minute', ts)`. */
export function usageMinuteBucket(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 60000);
}

export function amountCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Returns the existing row a detected usage duplicates, or null. `usedAt` is
 * required: with no timestamp the server defaults to now(), so such a row can
 * never match an older ledger entry.
 */
export function findExistingUsageMatch<T extends ExistingUsageRow>(
  detected: DuplicateCandidate,
  existingRows: T[]
): T | null {
  const cents = amountCents(detected.amount);
  const minute = usageMinuteBucket(detected.usedAt);
  if (minute === null) return null;

  for (const row of existingRows) {
    if (amountCents(Math.abs(row.transaction_amount)) !== cents) continue;
    if (usageMinuteBucket(row.timestamp) !== minute) continue;
    return row;
  }
  return null;
}
