import { describe, expect, it } from "vitest";
import { completedYears, lifetimeSavings, pickCelebration } from "./celebrationTrigger";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

function coupon(overrides: Partial<DecryptedCoupon> = {}): DecryptedCoupon {
  return {
    id: 1,
    company: "רמי לוי",
    code: "123",
    value: 100,
    cost: 80,
    used_value: 0,
    status: "פעיל",
    expiration: null,
    ...overrides,
  } as DecryptedCoupon;
}

const MID_MONTH = new Date(2026, 5, 15);
const MONTH_START = new Date(2026, 5, 2);

describe("completedYears", () => {
  it("counts only anniversaries that have passed", () => {
    expect(completedYears(new Date(2025, 5, 15), new Date(2026, 5, 15))).toBe(1);
    expect(completedYears(new Date(2025, 5, 16), new Date(2026, 5, 15))).toBe(0);
  });
});

describe("lifetimeSavings", () => {
  it("is face value minus what the coupons cost", () => {
    expect(lifetimeSavings([coupon({ value: 100, cost: 80 }), coupon({ value: 50, cost: 10 })]))
      .toBe(60);
  });
});

describe("pickCelebration", () => {
  it("returns nothing for an empty wallet", () => {
    expect(pickCelebration([], {}, MID_MONTH)).toBeNull();
  });

  it("celebrates a signup anniversary on the day itself", () => {
    const pick = pickCelebration([coupon()], { memberSince: "2025-06-15" }, MID_MONTH);
    expect(pick).toEqual({ kind: "anniversary", token: "anniversary:1" });
  });

  it("ignores the anniversary on any other day", () => {
    const pick = pickCelebration([coupon()], { memberSince: "2025-06-14" }, MID_MONTH);
    expect(pick?.kind).not.toBe("anniversary");
  });

  it("celebrates a coupon-count milestone", () => {
    const wallet = Array.from({ length: 25 }, (_, i) => coupon({ id: i, value: 10, cost: 10 }));
    const pick = pickCelebration(wallet, { walletRecord: 99_999 }, MID_MONTH);
    expect(pick).toEqual({ kind: "milestone", token: "milestone:25" });
  });

  it("does not repeat a milestone that was already celebrated", () => {
    const wallet = Array.from({ length: 25 }, (_, i) => coupon({ id: i, value: 10, cost: 10 }));
    const pick = pickCelebration(
      wallet,
      { walletRecord: 99_999, celebrated: ["milestone:25"] },
      MID_MONTH
    );
    expect(pick).toBeNull();
  });

  it("celebrates a new wallet record", () => {
    const pick = pickCelebration([coupon({ value: 5000, cost: 4000 })], {}, MID_MONTH);
    expect(pick?.kind).toBe("record");
  });

  it("ignores a wallet that only crept up", () => {
    const pick = pickCelebration(
      [coupon({ value: 1000, cost: 1000 })],
      { walletRecord: 900, celebrated: [] },
      MID_MONTH
    );
    expect(pick?.kind).not.toBe("record");
  });

  it("prefers the anniversary over a routine milestone", () => {
    const wallet = Array.from({ length: 25 }, (_, i) => coupon({ id: i, value: 10, cost: 10 }));
    const pick = pickCelebration(wallet, { memberSince: "2024-06-15" }, MID_MONTH);
    expect(pick?.kind).toBe("anniversary");
  });

  it("only offers the monthly recap at the start of a month", () => {
    // One coupon expired unused, so the clean-month scene is off the table and
    // the recap is the only month-start candidate left.
    const wallet = [coupon({ value: 100, cost: 90 }), coupon({ id: 2, expiration: "2026-06-01" })];
    expect(pickCelebration(wallet, { walletRecord: 99_999 }, MID_MONTH)).toBeNull();
    expect(pickCelebration(wallet, { walletRecord: 99_999 }, MONTH_START)?.kind).toBe("monthly");
  });

  it("celebrates a clean month when nothing expired unused", () => {
    const wallet = [coupon({ value: 100, cost: 90 })];
    const pick = pickCelebration(wallet, { walletRecord: 99_999 }, MONTH_START);
    expect(pick).toEqual({ kind: "clean", token: "clean:2026-6" });
  });

  it("skips the clean-month scene when a coupon expired unused", () => {
    const wallet = [coupon({ value: 100, cost: 90, expiration: "2026-06-01" })];
    const pick = pickCelebration(wallet, { walletRecord: 99_999 }, MONTH_START);
    expect(pick?.kind).not.toBe("clean");
  });
});
