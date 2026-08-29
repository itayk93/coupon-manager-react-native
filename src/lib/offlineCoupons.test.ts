import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

const { saveOfflineCoupons, loadOfflineCoupons, clearOfflineCoupons } = await import(
  "./offlineCoupons"
);

const KEY = "offline:coupons:v1";
const MAX_BYTES = 512 * 1024;

function coupon(overrides: Partial<DecryptedCoupon> = {}): DecryptedCoupon {
  return {
    id: 1,
    company: "שופרסל",
    expiration: "2026-03-01",
    status: "פעיל",
    value: 100,
    used_value: 0,
    code: "ABC123",
    description: "x".repeat(200),
    ...overrides,
  } as DecryptedCoupon;
}

describe("offline coupon mirror", () => {
  beforeEach(() => store.clear());

  it("returns what it stored, for the same user", async () => {
    await saveOfflineCoupons(7, [coupon()]);
    expect(await loadOfflineCoupons(7)).toHaveLength(1);
  });

  it("refuses to hand one user another user's wallet", async () => {
    await saveOfflineCoupons(7, [coupon()]);
    expect(await loadOfflineCoupons(8)).toBeNull();
  });

  it("treats a snapshot older than a month as absent", async () => {
    await saveOfflineCoupons(7, [coupon()]);
    const stale = JSON.parse(store.get(KEY)!);
    stale.savedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
    store.set(KEY, JSON.stringify(stale));
    expect(await loadOfflineCoupons(7)).toBeNull();
  });

  it("never exceeds its storage budget, however large the wallet", async () => {
    const huge = Array.from({ length: 5000 }, (_, i) => coupon({ id: i + 1 }));
    await saveOfflineCoupons(7, huge);
    expect(store.get(KEY)!.length).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("keeps spendable coupons when the budget forces a trim", async () => {
    const used = Array.from({ length: 3000 }, (_, i) =>
      coupon({ id: i + 1, status: "נוצל" }),
    );
    const live = coupon({ id: 99_999, status: "פעיל", expiration: "2026-01-05" });
    await saveOfflineCoupons(7, [...used, live]);
    const kept = await loadOfflineCoupons(7);
    expect(kept!.some((c) => c.id === 99_999)).toBe(true);
  });

  it("leaves nothing behind when cleared", async () => {
    await saveOfflineCoupons(7, [coupon()]);
    await clearOfflineCoupons();
    expect(await loadOfflineCoupons(7)).toBeNull();
  });
});
