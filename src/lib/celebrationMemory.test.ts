import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

const { isCelebrationFresh, loadCelebrationMemory, rememberCelebration, rememberRedemption } = await import(
  "./celebrationMemory"
);

const KEY = "widget_celebrations:v1";

describe("rememberRedemption", () => {
  beforeEach(() => store.clear());

  it("keeps the scene up until its end, and not a moment after", async () => {
    const until = new Date(Date.now() + 60_000);
    await rememberRedemption("redeemed", "מימשת את BuyMe · חסכת ₪100", until);
    const stored = await loadCelebrationMemory();
    expect(stored.shownKind).toBe("redeemed");
    expect(stored.shownText).toBe("מימשת את BuyMe · חסכת ₪100");
    expect(isCelebrationFresh(stored, until.getTime() - 1)).toBe(true);
    expect(isCelebrationFresh(stored, until.getTime())).toBe(false);
  });

  it("caps the stored headline", async () => {
    await rememberRedemption("redeemed", "א".repeat(5000), new Date(Date.now() + 60_000));
    const stored = await loadCelebrationMemory();
    expect(stored.shownText?.length).toBe(80);
    expect(store.get(KEY)!.length).toBeLessThan(1024);
  });

  it("keeps milestone tokens, and a later milestone drops the redemption text", async () => {
    await rememberCelebration({}, "milestone", "milestone:5", 100);
    await rememberRedemption("rescue", "הצלת ₪64 רגע לפני שפג", new Date(Date.now() + 60_000));
    let stored = await loadCelebrationMemory();
    expect(stored.celebrated).toEqual(["milestone:5"]);

    await rememberCelebration(stored, "milestone", "milestone:10", 100);
    stored = await loadCelebrationMemory();
    expect(stored.shownText).toBeUndefined();
    expect(stored.shownUntil).toBeUndefined();
  });
});
