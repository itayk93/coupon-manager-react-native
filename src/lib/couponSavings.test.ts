import { describe, expect, it } from "vitest";
import {
  giftValueUsed,
  isGiftCoupon,
  realizedSavings,
  savingsByMonth,
  spendEvents,
  totalRealizedSavings,
} from "./couponSavings";

const bought = { id: 1, value: 100, cost: 80, used_value: 50, date_added: "2026-01-10T10:00:00" };

describe("realizedSavings", () => {
  it("counts only the spent part: ₪100 bought for ₪80, half used, saved ₪10", () => {
    expect(realizedSavings(bought)).toBe(10);
  });

  it("never counts more than the face value as spent", () => {
    expect(realizedSavings({ value: 100, cost: 80, used_value: 250 })).toBe(20);
  });

  it("treats a coupon that cost nothing as a gift, not a saving", () => {
    const gift = { value: 200, cost: 0, used_value: 150 };
    expect(isGiftCoupon(gift)).toBe(true);
    expect(realizedSavings(gift)).toBe(0);
    expect(giftValueUsed(gift)).toBe(150);
    expect(giftValueUsed(bought)).toBe(0);
  });

  it("never goes negative for a coupon bought above face value", () => {
    expect(totalRealizedSavings([{ value: 100, cost: 120, used_value: 100 }, bought])).toBe(10);
  });
});

describe("spendEvents", () => {
  const usage = (timestamp: string, used_amount: number, details = "שימוש") => ({
    coupon_id: 1, timestamp, used_amount, details, action: null,
  });

  it("dates spending by the usage rows, capped at used_value", () => {
    const events = spendEvents(bought, [usage("2026-03-05", 30), usage("2026-04-05", 40)], []);
    expect(events.map((e) => [new Date(e.at).getMonth(), e.amount])).toEqual([[2, 30], [3, 20]]);
  });

  it("skips the hidden Multipass audit rows and dates unrecorded spending to the add date", () => {
    const events = spendEvents(bought, [usage("2026-03-05", 20, "עדכון אוטומטי via Multipass daily flow")], []);
    expect(events).toEqual([{ at: Date.parse(bought.date_added), amount: 50 }]);
  });

  it("ignores loadings in the transaction table", () => {
    const tx = { coupon_id: 1, transaction_date: "2026-02-01", usage_amount: 0, recharge_amount: 100, location: null, source: "x" };
    expect(spendEvents(bought, [], [tx])).toEqual([{ at: Date.parse(bought.date_added), amount: 50 }]);
  });
});

describe("savingsByMonth", () => {
  it("puts each month's saving where the money was spent, and leaves gifts out", () => {
    const gift = { id: 2, value: 100, cost: 0, used_value: 100, date_added: "2026-03-01T10:00:00" };
    const months = savingsByMonth(
      [bought, gift],
      [{ coupon_id: 1, timestamp: "2026-03-05T12:00:00", used_amount: 50, details: "x", action: null }],
      []
    );
    expect(months).toEqual({ "2026-2": 10 });
  });
});
