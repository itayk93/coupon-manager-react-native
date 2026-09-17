import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

const store = new Map<string, string>();
let reads = 0;
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => { reads += 1; return store.get(key) ?? null; },
  setItem: async (key: string, value: string) => { store.set(key, value); },
} }));

const { currentCelebration } = await import("./celebrationScene");
const KEY = "widget_celebrations:v1";

const wallet = (count: number) => Array.from({ length: count }, (_, id) => ({
  id, public_id: String(id), company: "בדיקה", code: "123", value: 10, cost: 10,
  used_value: 0, status: "פעיל", expiration: null, show_in_widget: false,
} as DecryptedCoupon));

/**
 * The widget sync and the app both ask for the running scene, often on the
 * same tick. `pickScene` reads storage before it writes, so two overlapping
 * calls would each see "nothing celebrated yet" and burn two milestones for
 * one moment. Sharing the in-flight promise is what stops that.
 */
describe("currentCelebration", () => {
  beforeEach(() => { store.clear(); reads = 0; });

  it("serves overlapping callers one scene, and reads storage once", async () => {
    const coupons = wallet(67);
    const [a, b] = await Promise.all([
      currentCelebration(coupons, null, null),
      currentCelebration(coupons, null, null),
    ]);

    expect(a).toEqual(b);
    expect(a?.kind).toBe("six-seven");
    expect(reads).toBe(1);
    expect(JSON.parse(store.get(KEY)!).celebrated).toEqual(["six-seven:67"]);
  });

  it("picks again once the first call has settled", async () => {
    const coupons = wallet(67);
    await currentCelebration(coupons, null, null);
    const again = await currentCelebration(coupons, null, null);

    // Same scene, because it is still held — not because the call was skipped.
    expect(again?.kind).toBe("six-seven");
    expect(reads).toBe(2);
  });

  it("stands down while a coupon is about to expire", async () => {
    const coupons = wallet(67);
    expect(await currentCelebration(coupons, null, 1)).toBeNull();
    expect(store.has(KEY)).toBe(false);
  });
});
