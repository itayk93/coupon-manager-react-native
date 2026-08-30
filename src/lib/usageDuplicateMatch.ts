/**
 * Client-side mirror of the duplicate rule enforced server-side in
 * `record_coupon_usage_batch` (migration 20260830143000). A detected usage is a
 * duplicate of an existing ledger row when all three match:
 *   - amount, rounded to agorot
 *   - place key: normalized place_name, falling back to place_address
 *   - timestamp, truncated to the minute
 *
 * Keeping this identical to the SQL means the modal flags exactly the rows the
 * server would silently skip — no false "already exists", no surprise skips.
 */

export type DuplicateCandidate = {
  amount: number;
  placeName?: string | null;
  placeAddress?: string | null;
  usedAt?: string | null;
};

export type ExistingUsageRow = {
  transaction_amount: number;
  place_name?: string | null;
  place_address?: string | null;
  timestamp?: string | null;
};

/** `lower(regexp_replace(btrim(name), '[[:space:][:punct:]]+', ' ', 'g'))` */
export function normalizeUsagePlaceKey(
  placeName?: string | null,
  placeAddress?: string | null
): string {
  const raw = (placeName && placeName.trim()) || (placeAddress && placeAddress.trim()) || "";
  return raw
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

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
 * required on both sides: with no timestamp the server defaults to now(), so
 * such a row can never match an older ledger entry.
 */
export function findExistingUsageMatch<T extends ExistingUsageRow>(
  detected: DuplicateCandidate,
  existingRows: T[]
): T | null {
  const cents = amountCents(detected.amount);
  const placeKey = normalizeUsagePlaceKey(detected.placeName, detected.placeAddress);
  const minute = usageMinuteBucket(detected.usedAt);
  if (minute === null) return null;

  for (const row of existingRows) {
    if (amountCents(Math.abs(row.transaction_amount)) !== cents) continue;
    if (normalizeUsagePlaceKey(row.place_name, row.place_address) !== placeKey) continue;
    if (usageMinuteBucket(row.timestamp) !== minute) continue;
    return row;
  }
  return null;
}
