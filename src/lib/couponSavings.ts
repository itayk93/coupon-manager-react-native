import type { DecryptedCoupon } from "@/hooks/useCoupons";
import {
  isHiddenLedgerRow,
  ledgerAmountFromTransaction,
  ledgerAmountFromUsage,
} from "./couponLedger";

/**
 * One definition of "how much did I save", shared by the statistics screen,
 * the company breakdown and the widget.
 *
 * Saving is what a coupon was worth minus what it cost — but only for the part
 * actually spent. A ₪100 coupon bought for ₪80 and half used saved ₪10, not
 * ₪20: the unspent half may still expire. A coupon that cost nothing (a gift,
 * an employer perk) is not a saving at all; it is money received, and is
 * counted separately so it does not inflate the savings figure.
 */

type SavingsCoupon = Pick<DecryptedCoupon, "value" | "cost" | "used_value">;

/** Cost 0 (or missing) with a real face value: received, not bought. */
export function isGiftCoupon(coupon: { value?: number | null; cost?: number | null }): boolean {
  return (coupon.cost ?? 0) <= 0 && (coupon.value ?? 0) > 0;
}

/** Share of every shekel spent that was saved: (value - cost) / value. */
export function savingsRate(coupon: SavingsCoupon): number {
  const value = coupon.value ?? 0;
  if (value <= 0 || isGiftCoupon(coupon)) return 0;
  return Math.max(0, value - (coupon.cost ?? 0)) / value;
}

/** Spent so far, never more than the coupon's face value. */
function spent(coupon: Pick<DecryptedCoupon, "value" | "used_value">): number {
  return Math.min(Math.max(0, coupon.used_value ?? 0), Math.max(0, coupon.value ?? 0));
}

/** Money saved on what was actually spent from a bought coupon. */
export function realizedSavings(coupon: SavingsCoupon): number {
  return spent(coupon) * savingsRate(coupon);
}

/** Money spent from coupons that were received for free. */
export function giftValueUsed(coupon: SavingsCoupon): number {
  return isGiftCoupon(coupon) ? spent(coupon) : 0;
}

export function totalRealizedSavings(coupons: SavingsCoupon[]): number {
  return coupons.reduce((sum, coupon) => sum + realizedSavings(coupon), 0);
}

export function totalGiftValueUsed(coupons: SavingsCoupon[]): number {
  return coupons.reduce((sum, coupon) => sum + giftValueUsed(coupon), 0);
}

// ------------------------------------------------------------ by usage date

export type UsageLedgerRow = {
  coupon_id: number;
  timestamp: string | null;
  used_amount: number | null;
  details: string | null;
  action: string | null;
};

export type TransactionLedgerRow = {
  coupon_id: number;
  transaction_date: string | null;
  usage_amount: number | null;
  recharge_amount: number | null;
  location: string | null;
  source: string | null;
};

type SpendEvent = { at: number; amount: number };

/**
 * When each shekel of a coupon was spent.
 *
 * Reads the ledger the same way the coupon history does (hidden audit rows
 * out, loadings ignored), then trusts `used_value` for the total: the dated
 * rows are kept oldest first up to that total, and any spending the ledger
 * never recorded (legacy imports) is dated to when the coupon was added, which
 * is also where the history screen shows it.
 */
export function spendEvents(
  coupon: Pick<DecryptedCoupon, "value" | "used_value" | "date_added">,
  usage: UsageLedgerRow[],
  transactions: TransactionLedgerRow[]
): SpendEvent[] {
  const dated: SpendEvent[] = [];
  for (const row of usage) {
    if (isHiddenLedgerRow(row.details || row.action || "")) continue;
    const amount = -ledgerAmountFromUsage(row.used_amount);
    const at = row.timestamp ? Date.parse(row.timestamp) : NaN;
    if (amount > 0 && Number.isFinite(at)) dated.push({ at, amount });
  }
  for (const row of transactions) {
    if (isHiddenLedgerRow(row.location || row.source || "")) continue;
    const amount = -ledgerAmountFromTransaction(row.recharge_amount, row.usage_amount);
    const at = row.transaction_date ? Date.parse(row.transaction_date) : NaN;
    if (amount > 0 && Number.isFinite(at)) dated.push({ at, amount });
  }
  dated.sort((a, b) => a.at - b.at);

  let left = spent(coupon);
  const events: SpendEvent[] = [];
  for (const event of dated) {
    if (left <= 0.005) break;
    const amount = Math.min(event.amount, left);
    events.push({ at: event.at, amount });
    left -= amount;
  }
  const added = coupon.date_added ? Date.parse(coupon.date_added) : NaN;
  if (left > 0.005 && Number.isFinite(added)) events.push({ at: added, amount: left });
  return events;
}

/** Savings per calendar month (device clock), keyed `${year}-${monthIndex}`. */
export function savingsByMonth(
  coupons: Pick<DecryptedCoupon, "id" | "value" | "cost" | "used_value" | "date_added">[],
  usage: UsageLedgerRow[],
  transactions: TransactionLedgerRow[]
): Record<string, number> {
  const usageById = groupBy(usage);
  const txById = groupBy(transactions);
  const months: Record<string, number> = {};
  for (const coupon of coupons) {
    const rate = savingsRate(coupon);
    if (rate <= 0) continue;
    for (const event of spendEvents(coupon, usageById.get(coupon.id) ?? [], txById.get(coupon.id) ?? [])) {
      const d = new Date(event.at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months[key] = (months[key] ?? 0) + event.amount * rate;
    }
  }
  return months;
}

function groupBy<T extends { coupon_id: number }>(rows: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const list = map.get(row.coupon_id);
    if (list) list.push(row);
    else map.set(row.coupon_id, [row]);
  }
  return map;
}
