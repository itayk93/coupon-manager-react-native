import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

const store = new Map<string, string>();
const write = vi.hoisted(() => vi.fn());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => { store.set(key, value); },
} }));
vi.mock("../../modules/coupon-widget", () => ({ setWidgetData: write }));
vi.mock("./widgetLogos", () => ({ prepareWidgetLogos: async () => ({}) }));
vi.mock("./widgetDebugOverride", () => ({ loadWidgetDebugOverride: async () => null }));
const { syncWidget } = await import("./widgetSync");
const KEY = "widget_celebrations:v1";
const wallet = (count: number) => Array.from({ length: count }, (_, id) => ({
  id, public_id: String(id), company: "בדיקה", code: "123", value: 10, cost: 10,
  used_value: 0, status: "פעיל", expiration: null, show_in_widget: false,
} as DecryptedCoupon));

describe("67 widget celebration", () => {
  beforeEach(() => { store.clear(); write.mockClear(); });
  it("replaces a held record with 67 and preserves its headline after the count changes", async () => {
    store.set(KEY, JSON.stringify({ shownAt: new Date().toISOString(), shownKind: "record", shownUntil: new Date(Date.now()+60000).toISOString() }));
    await syncWidget(wallet(67));
    expect(write.mock.lastCall?.[0]).toMatchObject({ celebration: "six-seven", celebrationText: "67 קופונים!" });
    expect(JSON.parse(store.get(KEY)!).celebrated).toContain("six-seven:67");
    await syncWidget(wallet(68));
    expect(write.mock.lastCall?.[0].celebrationText).toBe("67 קופונים!");
  });
  it("keeps urgent expiry ahead of the celebration without consuming the milestone", async () => {
    const coupons = wallet(67);
    const today = new Date();
    coupons[0].expiration = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    await syncWidget(coupons);
    expect(write.mock.lastCall?.[0].celebration).toBeNull();
    expect(store.has(KEY)).toBe(false);
  });
  it("keeps a fresh redemption scene until it expires", async () => {
    store.set(KEY, JSON.stringify({ shownAt: new Date().toISOString(), shownKind: "redeemed", shownText: "מימשת קופון!", shownUntil: new Date(Date.now()+60000).toISOString() }));
    await syncWidget(wallet(67));
    expect(write.mock.lastCall?.[0].celebration).toBe("redeemed");
    expect(JSON.parse(store.get(KEY)!).celebrated).toBeUndefined();
  });
});
