import { beforeEach, describe, expect, it, vi } from "vitest";
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
  getNativePushState: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("./notificationFaces", () => ({
  expiryFaceAttachment: vi.fn(async () => undefined),
}));

const Notifications = await import("expo-notifications");
const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
const { getNativePushState } = await import("@/lib/nativeNotifications");
const { planExpiryAlerts, syncLocalExpiryAlerts } = await import("./localExpiryAlerts");

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

/** Every coupon in a plan, flattened, for the assertions that do not care how
 *  the reminders were grouped. */
const allDays = (planned: ReturnType<typeof planExpiryAlerts>) =>
  planned.flatMap((alert) => alert.coupons.map((c) => c.daysLeft));

describe("planExpiryAlerts", () => {
  it("schedules one reminder per configured window", () => {
    const planned = planExpiryAlerts([coupon()], PREFS, NOW);
    expect(allDays(planned)).toEqual([30, 7, 1, 0]);
  });

  it("orders by date so the platform cap keeps the soonest alerts", () => {
    const planned = planExpiryAlerts([coupon()], PREFS, NOW);
    const dates = planned.map((a) => a.at);
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("skips windows that have already passed", () => {
    const soon = coupon({ expiration: "2026-01-05" });
    expect(allDays(planExpiryAlerts([soon], PREFS, NOW))).toEqual([1, 0]);
  });

  it("ignores used coupons and coupons with no expiry", () => {
    const used = coupon({ id: 2, status: "נוצל" });
    const undated = coupon({ id: 3, expiration: null });
    expect(planExpiryAlerts([used, undated], PREFS, NOW)).toEqual([]);
  });

  it("tells the user once when a daily reminder lands on a window day", () => {
    const planned = planExpiryAlerts([coupon()], { ...PREFS, daily_within: 7 }, NOW);
    const keys = planned.flatMap((alert) =>
      alert.coupons.map((c) => `${c.couponId}:${c.daysLeft}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("raises one banner for every coupon that lands on the same morning", () => {
    // Three coupons, same expiry date, so every window collides.
    const wallet = [1, 2, 3].map((id) => coupon({ id, company: `חברה ${id}` }));
    const planned = planExpiryAlerts(wallet, PREFS, NOW);
    expect(planned).toHaveLength(4);
    for (const alert of planned) expect(alert.coupons).toHaveLength(3);
  });

  it("groups by the moment, not the deadline, so mixed windows still share a banner", () => {
    // Expiry day for one, the week-before mark for the other: same morning.
    const wallet = [
      coupon({ id: 1, expiration: "2026-02-10" }),
      coupon({ id: 2, expiration: "2026-02-17" }),
    ];
    const planned = planExpiryAlerts(wallet, PREFS, NOW);
    const shared = planned.find((alert) => alert.coupons.length > 1);
    expect(shared?.coupons.map((c) => c.daysLeft)).toEqual([0, 7]);
  });

  it("raises one banner a morning for the wallet that prompted this", () => {
    // The reported case: two coupons a day apart, daily reminder switched on.
    // Ungrouped this was one banner per coupon per morning.
    const wallet = [
      coupon({ id: 1, company: "Babka", expiration: "2026-01-15" }),
      coupon({ id: 2, company: "BuyMe", expiration: "2026-01-14" }),
    ];
    const planned = planExpiryAlerts(wallet, { ...PREFS, daily_within: 14 }, NOW);
    const couponAlerts = planned.reduce((n, a) => n + a.coupons.length, 0);
    expect(couponAlerts).toBe(29);
    expect(planned).toHaveLength(15);
    // Every morning both coupons are due, they share the one banner.
    expect(planned.filter((a) => a.coupons.length === 2)).toHaveLength(14);
  });

  it("stays under the platform's pending-notification limit", () => {
    const wallet = Array.from({ length: 40 }, (_, i) =>
      coupon({ id: i + 1, expiration: `2026-0${(i % 3) + 2}-1${i % 9}` }),
    );
    const planned = planExpiryAlerts(wallet, { ...PREFS, daily_within: 14 }, NOW);
    expect(planned.length).toBeLessThanOrEqual(56);
  });

  it("spends the platform budget on days rather than on coupons", () => {
    // Forty coupons sharing one expiry date: ungrouped this was forty slots for
    // a single morning, and the cap was reached before the week was out.
    const wallet = Array.from({ length: 40 }, (_, i) => coupon({ id: i + 1 }));
    const planned = planExpiryAlerts(wallet, { ...PREFS, daily_within: 14 }, NOW);
    const moments = new Set(planned.map((a) => a.at));
    expect(planned.length).toBe(moments.size);
    // Every window and every daily day still reaches the user.
    expect(planned.length).toBeGreaterThanOrEqual(15);
  });

  it("holds everything back until a quiet period is over", () => {
    const prefs = { ...PREFS, quiet_until: "2026-02-25T00:00:00Z" };
    expect(allDays(planExpiryAlerts([coupon()], prefs, NOW))).toEqual([1, 0]);
  });
});

describe("syncLocalExpiryAlerts", () => {
  // The sync reads the real clock, so the wallet it is given has to expire
  // ahead of whenever the suite runs.
  const future = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  beforeEach(() => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
    vi.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([] as never);
    vi.mocked(Notifications.scheduleNotificationAsync).mockClear();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null as never);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined as never);
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined as never);
  });

  it("leaves expiry reminders to the server when the device gets push", async () => {
    vi.mocked(getNativePushState).mockResolvedValue({
      supported: true,
      permission: "granted",
      subscribed: true,
      expoToken: "ExponentPushToken[x]",
    } as never);

    await syncLocalExpiryAlerts([coupon()], PREFS);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules them itself when the device has no push registration", async () => {
    vi.mocked(getNativePushState).mockResolvedValue({
      supported: true,
      permission: "granted",
      subscribed: false,
    } as never);

    await syncLocalExpiryAlerts([coupon({ expiration: future })], PREFS);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it("cancels old local reminders when push is active, without touching other reminders", async () => {
    vi.mocked(getNativePushState).mockResolvedValue({ subscribed: true } as never);
    vi.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
      { identifier: "expiry", content: { data: { kind: "local-expiry" } } },
      { identifier: "other", content: { data: { kind: "other" } } },
    ] as never);
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
    await syncLocalExpiryAlerts([coupon()], PREFS);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledExactlyOnceWith("expiry");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("does not schedule duplicate reminders when push status cannot be checked", async () => {
    vi.mocked(getNativePushState).mockRejectedValue(new Error("offline"));
    await syncLocalExpiryAlerts([coupon({ expiration: future })], PREFS);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
