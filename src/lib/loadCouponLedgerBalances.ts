import { supabase } from "@/integrations/supabase/client";
import type { DecryptedCoupon } from "@/types/coupon";
import { withLedgerBalances } from "./couponLedgerBalances";

const PAGE_SIZE = 1000;
const COUPON_BATCH_SIZE = 100;

/** Batch the wallet and page both tables. A partial response must not restore money. */
export async function loadCouponLedgerBalances(coupons: DecryptedCoupon[]): Promise<DecryptedCoupon[]> {
  if (!coupons.length) return coupons;
  const usage: Parameters<typeof withLedgerBalances>[1] = [];
  const transactions: Parameters<typeof withLedgerBalances>[2] = [];
  for (let start = 0; start < coupons.length; start += COUPON_BATCH_SIZE) {
    const ids = coupons.slice(start, start + COUPON_BATCH_SIZE).map(c => c.id);
    for (const table of ["coupon_usage", "coupon_transaction"] as const) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const columns = table === "coupon_usage"
          ? "id,coupon_id,used_amount,details,action"
          : "id,coupon_id,recharge_amount,usage_amount,location,source";
        const { data, error } = await supabase.from(table).select(columns).in("coupon_id", ids).order("id").range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (table === "coupon_usage") usage.push(...((data ?? []) as unknown as Parameters<typeof withLedgerBalances>[1]));
        else transactions.push(...((data ?? []) as unknown as Parameters<typeof withLedgerBalances>[2]));
        if (!data || data.length < PAGE_SIZE) break;
      }
    }
  }
  return withLedgerBalances(coupons, usage, transactions);
}
