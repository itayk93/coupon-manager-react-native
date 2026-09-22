import { describe, expect, it } from "vitest";
import { milestonesFor, summariseMilestones } from "./milestones";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

describe("summariseMilestones", () => {
  it("reads nothing out of an empty history", () => {
    const summary = summariseMilestones([]);
    expect(summary.total).toBe(0);
    expect(summary.oneOffs).toEqual([]);
    expect(summary.repeats).toEqual([]);
    expect(summary.ladders.every((l) => l.best === null)).toBe(true);
    // An untouched ladder still points at its first rung.
    expect(summary.ladders[0].next).toBe(5);
  });

  it("marks every rung at or below the best one as passed", () => {
    const { ladders } = summariseMilestones(["milestone:25"]);
    const counts = ladders[0];
    expect(counts.best).toBe(25);
    expect(counts.next).toBe(50);
    expect(counts.steps.map((s) => s.reached)).toEqual([true, true, true, false, false, false]);
  });

  it("has no next rung once the ladder is topped out", () => {
    const { ladders } = summariseMilestones(["savings:100000"]);
    expect(ladders[1].best).toBe(100_000);
    expect(ladders[1].next).toBeNull();
  });

  it("keeps only the best of a repeated one-off", () => {
    // Three wallet records in a row is one fact about the wallet.
    const { oneOffs } = summariseMilestones(["record:900", "record:1500", "record:1200"]);
    expect(oneOffs).toEqual([{ kind: "record", value: 1500 }]);
  });

  it("counts the months instead of listing them", () => {
    const { repeats } = summariseMilestones(["clean:2026-7", "clean:2026-8", "monthly:2026-8"]);
    expect(repeats).toEqual([
      { kind: "clean", count: 2 },
      { kind: "monthly", count: 1 },
    ]);
  });

  it("ignores anything that is not a token", () => {
    const summary = summariseMilestones(["", "nonsense", ":5", "milestone:10"]);
    expect(summary.ladders[0].best).toBe(10);
  });

  it("counts rungs passed, not tokens held", () => {
    // A wallet derived at 25 in one go has passed 5, 10 and 25 just as surely
    // as one that was celebrated at each of them.
    expect(summariseMilestones(["milestone:25"]).total).toBe(3);
    expect(summariseMilestones(["milestone:5", "milestone:10", "milestone:25"]).total).toBe(3);
  });

  it("counts a month celebrated twice once", () => {
    expect(summariseMilestones(["clean:2026-7", "clean:2026-7"]).repeats).toEqual([
      { kind: "clean", count: 1 },
    ]);
  });
});

function coupon(overrides: Partial<DecryptedCoupon> = {}): DecryptedCoupon {
  // ₪100 bought for ₪80 and fully spent: ₪20 saved.
  return {
    id: 1,
    company: "רמי לוי",
    code: "123",
    value: 100,
    cost: 80,
    used_value: 100,
    status: "פעיל",
    expiration: null,
    ...overrides,
  } as DecryptedCoupon;
}

/**
 * The tokens are device-local, so an installed web app that is reinstalled, or
 * a second device, starts with none of them — and the wallet is the same
 * wallet. These are the ladders the wallet can prove on its own.
 */
describe("milestonesFor", () => {
  it("shows what the wallet has passed even when the device remembers nothing", () => {
    // 35 spendable coupons, ₪7,000 saved: the real wallet this was found on.
    const wallet = Array.from({ length: 35 }, (_, i) =>
      coupon({ id: i + 1, value: 1000, cost: 800, used_value: 1000 }),
    );
    const { ladders, total } = milestonesFor(wallet, []);
    expect(ladders[0].best).toBe(25);
    expect(ladders[0].next).toBe(50);
    expect(ladders[1].best).toBe(5000);
    // 5, 10, 25 coupons and ₪1,000, ₪5,000 saved.
    expect(total).toBe(5);
  });

  it("never takes back a milestone the wallet has since fallen below", () => {
    const { ladders } = milestonesFor([coupon(), coupon({ id: 2 })], ["milestone:50"]);
    expect(ladders[0].best).toBe(50);
  });

  it("keeps the moments only the device can know", () => {
    const { oneOffs, repeats } = milestonesFor([coupon()], ["record:1500", "clean:2026-7"]);
    expect(oneOffs).toEqual([{ kind: "record", value: 1500 }]);
    expect(repeats).toEqual([{ kind: "clean", count: 1 }]);
  });

  it("claims nothing for a wallet that has passed nothing", () => {
    expect(milestonesFor([coupon({ value: 10, cost: 9 })], []).total).toBe(0);
  });
});
