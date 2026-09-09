import { describe, expect, it } from "vitest";
import { expiringWidgetCoupons } from "./widgetExpiry";
const now = new Date("2026-09-09T12:00:00");
describe("widget expiry selection", () => {
  it("selects the nearest exact deadline, with date-only vouchers valid through today", () => {
    const coupons = [
      { id: 1, expiration: "2026-09-09" },
      { id: 2, expiration: "2026-09-09T18:00:00" },
      { id: 3, expiration: "2026-09-09T13:00:00" },
      { id: 4, expiration: "2026-09-10" },
    ];
    expect(expiringWidgetCoupons(coupons, now).map(e => e.coupon.id)).toEqual([3, 2, 1, 4]);
    expect(expiringWidgetCoupons(coupons, now)[0].days).toBe(0);
  });
  it("excludes already expired times, invalid dates, missing dates and beyond a week", () => {
    expect(expiringWidgetCoupons([
      { id: 1, expiration: "2026-09-09T11:59:00" },
      { id: 2, expiration: "invalid" },
      { id: 3, expiration: null },
      { id: 4, expiration: "2026-09-17" },
    ], now)).toEqual([]);
  });
  it("breaks equal deadlines consistently by coupon id", () => {
    expect(expiringWidgetCoupons([
      { id: 8, expiration: "2026-09-09" },
      { id: 2, expiration: "2026-09-09" },
    ], now).map(e => e.coupon.id)).toEqual([2, 8]);
  });
});
