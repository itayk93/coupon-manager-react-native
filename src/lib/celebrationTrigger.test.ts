import { describe, expect, it } from "vitest";
import {
  completedYears,
  endOfIsraelDay,
  lifetimeSavings,
  pickCelebration,
  pickSixSevenCelebration,
  redemptionCelebration,
} from "./celebrationTrigger";
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
  it("is face value minus cost, on the spent part only", () => {
    expect(
      lifetimeSavings([coupon({ value: 100, cost: 80, used_value: 50 }), coupon({ value: 50, cost: 10, used_value: 50 })])
    ).toBe(50);
  });

  it("leaves out coupons that cost nothing", () => {
    expect(lifetimeSavings([coupon({ value: 100, cost: 0, used_value: 100 })])).toBe(0);
  });
});

describe("pickCelebration", () => {
  it("celebrates exactly 67 spendable coupons ahead of a new wallet record", () => {
    const wallet = Array.from({ length: 67 }, (_, id) => coupon({ id, value: 10, cost: 10 }));
    expect(pickCelebration(wallet, { walletRecord: 0 }, MID_MONTH)).toEqual({ kind: "six-seven", token: "six-seven:67" });
    expect(pickSixSevenCelebration(wallet.slice(1))).toBeNull();
    expect(pickSixSevenCelebration([...wallet, coupon({ id: 68 })])).toBeNull();
  });

  it("does not replay 67 after it was celebrated or count fully spent coupons", () => {
    const wallet = Array.from({ length: 67 }, (_, id) => coupon({ id }));
    expect(pickSixSevenCelebration(wallet, { celebrated: ["six-seven:67"] })).toBeNull();
    expect(pickSixSevenCelebration([...wallet.slice(1), coupon({ status: "נוצל" })])).toBeNull();
    expect(pickSixSevenCelebration([...wallet, coupon({ status: "נוצל" })])?.kind).toBe("six-seven");
  });

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
    const pick = pickCelebration([coupon({ value: 5000, cost: 4000 })], { walletRecord: 3000 }, MID_MONTH);
    expect(pick?.kind).toBe("record");
  });

  it("does not call the first wallet it ever sees a record", () => {
    const pick = pickCelebration([coupon({ value: 5000, cost: 4000 })], {}, MID_MONTH);
    expect(pick?.kind).not.toBe("record");
  });

  it("counts any new high as a record, however small the step", () => {
    const pick = pickCelebration([coupon({ value: 1000, cost: 1000 })], { walletRecord: 999 }, MID_MONTH);
    expect(pick).toEqual({ kind: "record", token: "record:1000" });
  });

  it("ignores a wallet that only matched its old high", () => {
    const pick = pickCelebration([coupon({ value: 1000, cost: 1000 })], { walletRecord: 1000 }, MID_MONTH);
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
    const wallet = [coupon({ value: 100, cost: 90, used_value: 50 }), coupon({ id: 2, expiration: "2026-06-01" })];
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

describe("endOfIsraelDay", () => {
  it("ends at the next Israel midnight in summer time (UTC+3)", () => {
    // 14:24 in Israel on 11 Sep 2026.
    const now = new Date("2026-09-11T11:24:00Z");
    expect(endOfIsraelDay(now).toISOString()).toBe("2026-09-11T21:00:00.000Z");
  });

  it("ends at the next Israel midnight in winter time (UTC+2)", () => {
    const now = new Date("2026-12-01T08:00:00Z");
    expect(endOfIsraelDay(now).toISOString()).toBe("2026-12-01T22:00:00.000Z");
  });

  it("uses Israel's date, not UTC's, just after local midnight", () => {
    // 00:30 on 12 Sep in Israel is still 11 Sep in UTC.
    const now = new Date("2026-09-11T21:30:00Z");
    expect(endOfIsraelDay(now).toISOString()).toBe("2026-09-12T21:00:00.000Z");
  });
});

describe("redemptionCelebration", () => {
  const now = new Date("2026-09-11T11:24:00Z");

  it("celebrates the saving on an ordinary redemption", () => {
    const scene = redemptionCelebration(
      { company: "BuyMe", value: 100, cost: 80, expiration: "2026-12-31" },
      64,
      now
    );
    expect(scene.kind).toBe("redeemed");
    expect(scene.text).toBe("מימשת את BuyMe\nחסכת 20 ש״ח");
    // A coupon that cost nothing was a gift: no savings line.
    expect(redemptionCelebration({ company: "BuyMe", value: 100, cost: 0, expiration: "2026-12-31" }, 64, now).text)
      .toBe("מימשת את BuyMe");
    expect(scene.until.toISOString()).toBe("2026-09-11T21:00:00.000Z");
  });

  it("is a rescue when used within three days of expiry", () => {
    const scene = redemptionCelebration({ company: "BuyMe", value: 100, cost: 0, expiration: "2026-09-14" }, 64, now);
    expect(scene.kind).toBe("rescue");
    expect(scene.text).toBe("הצלת ₪64 רגע לפני שפג");
  });

  it("counts expiring today as a rescue, four days out as not", () => {
    expect(redemptionCelebration({ company: "X", value: 50, expiration: "2026-09-11" }, 10, now).kind).toBe("rescue");
    expect(redemptionCelebration({ company: "X", value: 50, expiration: "2026-09-15" }, 10, now).kind).toBe("redeemed");
  });

  it("names the coupon instead of an amount when there is none to quote", () => {
    expect(redemptionCelebration({ company: "Wolt", value: 50, cost: 50 }, 50, now).text).toBe("מימשת את Wolt");
    expect(redemptionCelebration({ company: "Wolt", is_one_time: true, value: 50 }, 50, now).text).toBe("מימשת את Wolt");
    expect(
      redemptionCelebration({ company: "Wolt", is_one_time: true, expiration: "2026-09-12" }, 0, now).text
    ).toBe("הצלת את Wolt רגע לפני שפג");
  });

  it("shortens a long company name so the headline fits the small widget", () => {
    const scene = redemptionCelebration({ company: "רשת חנויות גדולה מאוד בעלת שם ארוך", value: 10 }, 10, now);
    const name = scene.text.replace("מימשת את ", "").split("\n")[0];
    expect(name.length).toBe(18);
    expect(name.endsWith("…")).toBe(true);
  });
});
