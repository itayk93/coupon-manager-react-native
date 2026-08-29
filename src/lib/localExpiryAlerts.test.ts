import { describe, expect, it, vi } from "vitest";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));

// Both pull in react-native, which has no place in a node-environment unit test.
// The planner under test touches neither.
vi.mock("@/lib/nativeNotifications", () => ({
  ANDROID_CHANNEL_ID: "expiry-alerts",
  ensureAndroidChannel: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

const { planExpiryAlerts } = await import("./localExpiryAlerts");

const NOW = Date.parse("2026-01-01T00:00:00Z");

function coupon(overrides: Partial<DecryptedCoupon> = {}): DecryptedCoupon {
  return {
    id: 1,
    company: "שופרסל",
    expiration: "2026-03-01",
    status: "פעיל",
    value: 100,
    used_value: 0,
    ...overrides,
  } as DecryptedCoupon;
}

const PREFS = { windows: [30, 7, 1, 0], daily_within: null, quiet_until: null };

describe("planExpiryAlerts", () => {
  it("schedules one reminder per configured window", () => {
    const planned = planExpiryAlerts([coupon()], PREFS, NOW);
    expect(planned.map((a) => a.daysLeft)).toEqual([30, 7, 1, 0]);
  });

  it("orders by date so the platform cap keeps the soonest alerts", () => {
    const planned = planExpiryAlerts([coupon()], PREFS, NOW);
    const dates = planned.map((a) => a.at);
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("skips windows that have already passed", () => {
    const soon = coupon({ expiration: "2026-01-05" });
    expect(planExpiryAlerts([soon], PREFS, NOW).map((a) => a.daysLeft)).toEqual([1, 0]);
  });

  it("ignores used coupons and coupons with no expiry", () => {
    const used = coupon({ id: 2, status: "נוצל" });
    const undated = coupon({ id: 3, expiration: null });
    expect(planExpiryAlerts([used, undated], PREFS, NOW)).toEqual([]);
  });

  it("tells the user once when a daily reminder lands on a window day", () => {
    const planned = planExpiryAlerts([coupon()], { ...PREFS, daily_within: 7 }, NOW);
    const keys = planned.map((a) => `${a.couponId}:${a.daysLeft}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stays under the platform's pending-notification limit", () => {
    const wallet = Array.from({ length: 40 }, (_, i) =>
      coupon({ id: i + 1, expiration: `2026-0${(i % 3) + 2}-1${i % 9}` }),
    );
    const planned = planExpiryAlerts(wallet, { ...PREFS, daily_within: 14 }, NOW);
    expect(planned.length).toBeLessThanOrEqual(56);
  });

  it("holds everything back until a quiet period is over", () => {
    const prefs = { ...PREFS, quiet_until: "2026-02-25T00:00:00Z" };
    expect(planExpiryAlerts([coupon()], prefs, NOW).map((a) => a.daysLeft)).toEqual([1, 0]);
  });
});
