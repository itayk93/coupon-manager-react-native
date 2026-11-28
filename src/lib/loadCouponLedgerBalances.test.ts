import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedCoupon } from "@/types/coupon";
const from = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { loadCouponLedgerBalances } from "./loadCouponLedgerBalances";
const coupon = { id: 1, value: 100, used_value: 0 } as DecryptedCoupon;
beforeEach(() => from.mockReset());
function mockPages(result: (table: string, start: number) => unknown) {
  from.mockImplementation(table => ({ select: () => ({ in: () => ({ order: () => ({ range: (start: number) => Promise.resolve(result(table, start)) }) }) }) }));
}
describe("batched balance loading", () => {
  it("pages past1000 rows and reads both tables", async () => {
    mockPages((table, start) => ({ data: table === "coupon_usage" && start === 0 ? Array.from({ length: 1000 }, () => ({ coupon_id: 1, used_amount: 0.01, details: null, action: null })) : table === "coupon_usage" ? [{ coupon_id: 1, used_amount: 34, details: null, action: null }] : [], error: null }));
    const [projected] = await loadCouponLedgerBalances([coupon]);
    expect(projected.ledger_used_value).toBeCloseTo(44);
    expect(from).toHaveBeenCalledTimes(3);
  });
  it("rejects partial errors rather than returning a restored balance", async () => {
    mockPages(table => table === "coupon_transaction" ? { data: null, error: new Error("unavailable") } : { data: [], error: null });
    await expect(loadCouponLedgerBalances([coupon])).rejects.toThrow("unavailable");
  });
  it("does not query an empty wallet", async () => {
    expect(await loadCouponLedgerBalances([])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
