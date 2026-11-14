import { describe, expect, it } from "vitest";

import { dashboardVisibleCoupons } from "./dashboardCouponOrder";

const coupon = (over: Record<string, unknown>) =>
  ({
    id: 1,
    company: "שופרסל",
    code: "X",
    value: 100,
    used_value: 0,
    status: "פעיל",
    expiration: null,
    date_added: "2026-01-01T00:00:00Z",
    ...over,
  }) as any;

describe("dashboardVisibleCoupons", () => {
  it("drops used-up coupons exactly like the dashboard feed", () => {
    const used = coupon({ id: 1, status: "נוצל" });
    const active = coupon({ id: 2 });
    const out = dashboardVisibleCoupons([used, active], undefined);
    expect(out.map((c) => c.id)).toEqual([2]);
  });

  it("orders most-recently-used first, then most-used, then newest", () => {
    const old = coupon({ id: 1, date_added: "2026-01-01T00:00:00Z" });
    const fresh = coupon({ id: 2, date_added: "2026-06-01T00:00:00Z" });
    const frequent = coupon({ id: 3, date_added: "2026-01-01T00:00:00Z" });
    const recent = coupon({ id: 4, date_added: "2026-01-01T00:00:00Z" });
    const stats = {
      usageCountByCoupon: { 3: 9, 2: 0, 1: 0 },
      usageCountByCompany: {},
      latestUsageByCoupon: { 4: 1_700_000_000_000 },
      latestUsageByCompany: {},
    };
    const out = dashboardVisibleCoupons([old, fresh, frequent, recent], stats);
    expect(out.map((c) => c.id)).toEqual([4, 3, 2, 1]);
  });

  it("does not mutate the input array", () => {
    const a = coupon({ id: 1, date_added: "2026-01-01T00:00:00Z" });
    const b = coupon({ id: 2, date_added: "2026-06-01T00:00:00Z" });
    const input = [a, b];
    dashboardVisibleCoupons(input, undefined);
    expect(input.map((c) => c.id)).toEqual([1, 2]);
  });

  it("a company filter over it yields exactly the rows the old modal sheet showed", () => {
    // The modal sheet received the dashboard's visibleCoupons and re-filtered
    // by company. The native sheet must land on the same rows: same set,
    // same order, spendable-only.
    const keep1 = coupon({ id: 1, company: "שופרסל" });
    const keep2 = coupon({ id: 2, company: "שופרסל", date_added: "2026-06-01T00:00:00Z" });
    const usedUp = coupon({ id: 3, company: "שופרסל", status: "נוצל" });
    const otherCo = coupon({ id: 4, company: "רמי לוי", date_added: "2026-06-01T00:00:00Z" });
    const visible = dashboardVisibleCoupons([keep1, keep2, usedUp, otherCo], undefined);
    const rows = visible.filter((c) => c.company === "שופרסל");
    expect(rows.map((c) => c.id)).toEqual([2, 1]);
  });
});
