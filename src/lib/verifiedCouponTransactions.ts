/** Projection only. Original provider rows stay in the database unchanged.
 * Coupon 600's original BUYME gift history was checked on 2026-11-28.
 * These three Multipass rows mirror the corresponding BUYME import exactly.
 * Never infer duplicates from equal amounts, merchants or nearby dates.
 */
type Row = { id?: number; coupon_id: number; source: string | null; reference_number?: string | null; transaction_date?: string | null; usage_amount: number | null; recharge_amount: number | null };
const verifiedMirrors = [
  { id: 1757, canonicalId: 1762, canonicalReference: "buyme_ref_c9ddc2eb6b5afbe6", reference: "max_ref_1762116515_0", date: "2025-11-01T22:21:00", usage: 376, recharge: 0 },
  { id: 1758, canonicalId: 1763, canonicalReference: "buyme_ref_610a5d4f5f730040", reference: "max_ref_1762116515_1", date: "2025-07-03T10:21:00", usage: 12, recharge: 0 },
  { id: 1759, canonicalId: 1764, canonicalReference: "buyme_ref_c1652dc7432f9bd3", reference: "max_ref_1762116515_2", date: "2025-04-09T00:00:00", usage: 0, recharge: 400 },
];
export function withoutVerifiedMirrors<T extends Row>(rows: T[]): T[] {
  return rows.filter(row => !verifiedMirrors.some(m => row.coupon_id === 600 && row.id === m.id && row.source === "Multipass" && row.reference_number === m.reference && row.transaction_date === m.date && row.usage_amount === m.usage && row.recharge_amount === m.recharge && rows.some(c => c.coupon_id === 600 && c.id === m.canonicalId && c.source === "BuyMe" && c.reference_number === m.canonicalReference && c.transaction_date === m.date && c.usage_amount === m.usage && c.recharge_amount === m.recharge)));
}
