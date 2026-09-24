import { describe, expect, it } from "vitest";
import { belongsInWallet, mergeCouponIntoWallet, type WalletCoupon } from "./walletCache";

type TestCoupon = WalletCoupon & { value?: number };

const coupon = (id: number, extra: Partial<TestCoupon> = {}): TestCoupon => ({ id, status: "פעיל", ...extra });

describe("belongsInWallet", () => {
  it("keeps active and used coupons", () => {
    expect(belongsInWallet(coupon(1))).toBe(true);
    expect(belongsInWallet(coupon(1, { status: "נוצל" }))).toBe(true);
  });

  it("drops sold and trashed coupons, like the vault list does", () => {
    expect(belongsInWallet(coupon(1, { status: "נמכר" }))).toBe(false);
    expect(belongsInWallet(coupon(1, { deleted_at: "2026-09-01T00:00:00Z" }))).toBe(false);
  });
});

describe("mergeCouponIntoWallet", () => {
  it("puts a new coupon at the top", () => {
    const merged = mergeCouponIntoWallet([coupon(1), coupon(2)], coupon(3));
    expect(merged.map((c) => c.id)).toEqual([3, 1, 2]);
  });

  it("replaces an edited coupon in place", () => {
    const merged = mergeCouponIntoWallet(
      [coupon(1), coupon(2, { value: 50 }), coupon(3)],
      coupon(2, { value: 80 })
    );
    expect(merged.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(merged[1]).toMatchObject({ id: 2, value: 80 });
  });

  it("keeps the cached shared flag, which the vault's answer lacks", () => {
    const merged = mergeCouponIntoWallet([coupon(1, { is_shared_with_me: true })], coupon(1, { value: 5 }));
    expect(merged[0].is_shared_with_me).toBe(true);
  });

  it("removes a coupon that was just sold", () => {
    const merged = mergeCouponIntoWallet([coupon(1), coupon(2)], coupon(2, { status: "נמכר" }));
    expect(merged.map((c) => c.id)).toEqual([1]);
  });

  it("does not add a sold coupon it never had", () => {
    const current = [coupon(1)];
    expect(mergeCouponIntoWallet(current, coupon(2, { status: "נמכר" }))).toBe(current);
  });
});
