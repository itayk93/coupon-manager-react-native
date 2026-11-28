import type { DecryptedCoupon } from "@/types/coupon";
import { effectiveUsedValue, isHiddenLedgerRow, ledgerAmountFromTransaction, ledgerAmountFromUsage } from "./couponLedger";

type Usage = { coupon_id: number; used_amount: number | null; details: string | null; action: string | null };
type Transaction = { coupon_id: number; recharge_amount: number | null; usage_amount: number | null; location: string | null; source: string | null };

/** A projection only: original stored spending and ledger rows stay untouched. */
export function withLedgerBalances(coupons: DecryptedCoupon[], usage: Usage[], transactions: Transaction[]): DecryptedCoupon[] {
  const amounts = new Map<number, number[]>();
  const add = (id: number, amount: number) => amounts.set(id, [...(amounts.get(id) ?? []), amount]);
  for (const row of usage) {
    if (!isHiddenLedgerRow(row.details || row.action || "")) add(row.coupon_id, ledgerAmountFromUsage(row.used_amount));
  }
  for (const row of transactions) {
    if (!isHiddenLedgerRow(row.location || row.source || "")) add(row.coupon_id, ledgerAmountFromTransaction(row.recharge_amount, row.usage_amount));
  }
  return coupons.map(coupon => ({ ...coupon, ledger_used_value: effectiveUsedValue(coupon.value ?? 0, coupon.used_value ?? 0, amounts.get(coupon.id) ?? []) }));
}
