import { describe, expect, it } from "vitest";
import {
  daysUntil,
  isSundayIn,
  isoWeekKey,
  splitBalanceChanges,
  weeklyPick,
  type PickCoupon,
} from "../../supabase/functions/_shared/weeklyPick";

const today = new Date("2026-09-20T09:00:00Z"); // a Sunday

const coupon = (id: number, overrides: Partial<PickCoupon> = {}): PickCoupon => ({
  id,
  public_id: `c${id}`,
  company: `חברה ${id}`,
  value: 200,
  used_value: 0,
  status: "פעיל",
  expiration: "2026-10-20",
  ...overrides,
});

describe("weeklyPick", () => {
  it("picks the coupon losing the most per day of waiting", () => {
    const pick = weeklyPick(
      [
        coupon(1, { value: 300, expiration: "2026-11-15" }), // 300 over 56 days
        coupon(2, { value: 150, expiration: "2026-10-05" }), // 150 over 15 days
      ],
      today,
    );
    expect(pick?.coupon.id).toBe(2);
    expect(pick?.remaining).toBe(150);
    expect(pick?.daysLeft).toBe(15);
    expect(pick?.others).toBe(1);
  });

  it("leaves the last week to the expiry reminders and ignores the far future", () => {
    expect(weeklyPick([coupon(1, { expiration: "2026-09-25" })], today)).toBeNull();
    expect(weeklyPick([coupon(1, { expiration: "2027-03-01" })], today)).toBeNull();
  });

  it("skips spent, small, finished and undated coupons", () => {
    expect(
      weeklyPick(
        [
          coupon(1, { used_value: 190 }),
          coupon(2, { status: "נוצל" }),
          coupon(3, { expiration: null }),
        ],
        today,
      ),
    ).toBeNull();
  });
});

describe("dates", () => {
  it("counts calendar days to the expiry", () => {
    expect(daysUntil("2026-09-28", today)).toBe(8);
  });

  it("keys a week the ISO way, across a year boundary too", () => {
    expect(isoWeekKey(today)).toBe("2026-W38");
    expect(isoWeekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });

  it("reads Sunday in the user's own zone", () => {
    expect(isSundayIn("Asia/Jerusalem", today)).toBe(true);
    // 23:30 UTC on Saturday is already Sunday in Israel.
    expect(isSundayIn("Asia/Jerusalem", new Date("2026-09-19T23:30:00Z"))).toBe(true);
    expect(isSundayIn("UTC", new Date("2026-09-19T23:30:00Z"))).toBe(false);
  });
});

describe("splitBalanceChanges", () => {
  it("separates money that left without a record from a plain refresh", () => {
    const drop = { id: 1, publicId: "a", company: "Multipass", oldRemaining: 200, newRemaining: 120 };
    const rise = { id: 2, publicId: "b", company: "BuyMe", oldRemaining: 50, newRemaining: 80 };
    expect(splitBalanceChanges([drop, rise])).toEqual({ unrecorded: [drop], refreshed: [rise] });
  });
});
