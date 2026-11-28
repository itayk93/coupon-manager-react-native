import { describe, expect, it } from "vitest";
import type { DecryptedCoupon } from "@/types/coupon";
import { withLedgerBalances } from "./couponLedgerBalances";
import { couponRemainingValue, couponUsedValue, isCouponUsed, totalRemainingValue } from "./couponTotals";
const coupon = (used_value = 0) => ({ id: 1, value: 100, used_value, status: "פעיל" } as DecryptedCoupon);
const transaction = (usage_amount: number | null, recharge_amount: number | null = null) => ({ coupon_id: 1, usage_amount, recharge_amount, location: null, source: "multipass" });
describe("read-only wallet ledger projection", () => {
  it("shows56 available and44 used from recharge100 and spend44 with stale stored0", () => {
    const original = coupon();
    const [projected] = withLedgerBalances([original], [], [transaction(44), transaction(null, 100)]);
    expect(couponRemainingValue(projected)).toBe(56);
    expect(couponUsedValue(projected)).toBe(44);
    expect(totalRemainingValue([projected])).toBe(56);
    expect(projected.used_value).toBe(0);
    expect(original).not.toHaveProperty("ledger_used_value");
  });
  it("keeps greater stored spending for incomplete history", () => {
    const [projected] = withLedgerBalances([coupon(60)], [], [transaction(44)]);
    expect(couponRemainingValue(projected)).toBe(40);
  });
  it("does not count hidden Multipass audit twice", () => {
    const usage = [{ coupon_id: 1, used_amount: 44, details: "עדכון אוטומטי via Multipass daily flow", action: null }];
    const [projected] = withLedgerBalances([coupon()], usage, [transaction(44), transaction(null, 100)]);
    expect(couponRemainingValue(projected)).toBe(56);
  });
  it("supports manual usage, empty history, and fully-used classification", () => {
    const usage = [{ coupon_id: 1, used_amount: 100, details: "manual", action: null }];
    expect(isCouponUsed(withLedgerBalances([coupon()], usage, [])[0])).toBe(true);
    expect(couponRemainingValue(withLedgerBalances([coupon(20)], [], [])[0])).toBe(80);
  });
  it("does not mix coupons or erase negative stored balances", () => {
    const other = { ...coupon(), id: 2 };
    const projected = withLedgerBalances([coupon(), other, { ...coupon(112), id: 3 }], [], [transaction(44)]);
    expect(projected.map(couponRemainingValue)).toEqual([56, 100, -12]);
  });
});
