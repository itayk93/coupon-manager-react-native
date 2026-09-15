import { describe, expect, it } from "vitest";
import { monthlyRecap } from "./monthlyRecap";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

const now = new Date(2026, 8, 15); // 15 September 2026
const SEPT = "2026-8";
const AUG = "2026-7";

function coupon(overrides: Partial<DecryptedCoupon> = {}): DecryptedCoupon {
  return {
    id: 1, public_id: "1", company: "בדיקה", code: "1", value: 100, cost: 60,
    used_value: 0, status: "פעיל", expiration: null, show_in_widget: false,
    ...overrides,
  } as DecryptedCoupon;
}

describe("monthlyRecap", () => {
  it("compares the month with the one before it", () => {
    const recap = monthlyRecap([], { [SEPT]: 340, [AUG]: 200 }, now);
    expect(recap.saved).toBe(340);
    expect(recap.previousSaved).toBe(200);
    expect(recap.delta).toBe(140);
    expect(recap.key).toBe(SEPT);
  });

  it("treats a month with no record as zero rather than missing", () => {
    const recap = monthlyRecap([], {}, now);
    expect(recap.saved).toBe(0);
    expect(recap.delta).toBe(0);
    expect(recap.clean).toBe(true);
  });

  it("counts money that reached its date unused", () => {
    const recap = monthlyRecap(
      [coupon({ id: 1, expiration: "2026-09-03", value: 100, used_value: 20 })],
      {},
      now
    );
    expect(recap.lostCount).toBe(1);
    expect(recap.lostValue).toBe(80);
    expect(recap.clean).toBe(false);
  });

  it("leaves a coupon still expiring later this month out of the tally", () => {
    // It is rescuable, so it belongs on the at-risk page, not in what was lost.
    const recap = monthlyRecap([coupon({ expiration: "2026-09-28" })], {}, now);
    expect(recap.lostCount).toBe(0);
    expect(recap.clean).toBe(true);
  });

  it("ignores a coupon that was actually used, and one worth nothing", () => {
    const recap = monthlyRecap(
      [
        coupon({ id: 1, expiration: "2026-09-02", status: "נוצל" }),
        coupon({ id: 2, expiration: "2026-09-02", value: 100, used_value: 100 }),
      ],
      {},
      now
    );
    expect(recap.lostCount).toBe(0);
  });

  it("ignores coupons from other months", () => {
    const recap = monthlyRecap([coupon({ expiration: "2026-08-20" })], {}, now);
    expect(recap.lostCount).toBe(0);
  });
});
