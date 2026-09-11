import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

const {
  isCelebrationFresh,
  loadCelebrationMemory,
  nextLocalMidnight,
  rememberCelebration,
  rememberRedemption,
  seedCelebrationBaseline,
  toCelebrationState,
} = await import("./celebrationMemory");
const { baselineCelebrationTokens, pickCelebration } = await import("./celebrationTrigger");
type DecryptedCoupon = import("@/hooks/useCoupons").DecryptedCoupon;

const KEY = "widget_celebrations:v1";

describe("rememberRedemption", () => {
  beforeEach(() => store.clear());

  it("keeps the scene up until its end, and not a moment after", async () => {
    const until = new Date(Date.now() + 60_000);
    await rememberRedemption("redeemed", "מימשת את BuyMe\nחסכת 100 ש״ח", until);
    const stored = await loadCelebrationMemory();
    expect(stored.shownKind).toBe("redeemed");
    expect(stored.shownText).toBe("מימשת את BuyMe\nחסכת 100 ש״ח");
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
    expect(stored.shownUntil).toBe(nextLocalMidnight().toISOString());
  });
});

describe("seedCelebrationBaseline", () => {
  beforeEach(() => store.clear());

  it("takes a first-seen wallet as done, so a reinstall celebrates nothing old", async () => {
    const wallet = Array.from({ length: 30 }, (_, i) => ({
      id: i, company: "x", code: "1", value: 100, cost: 0, used_value: 0, status: "פעיל", expiration: null,
    })) as unknown as DecryptedCoupon[];
    const seeded = await seedCelebrationBaseline({}, 3000, baselineCelebrationTokens(wallet));
    expect(seeded.walletRecord).toBe(3000);
    expect(seeded.celebrated).toEqual(["milestone:25", "savings:1000"]);
    expect(pickCelebration(wallet, toCelebrationState(seeded, null), new Date(2026, 5, 15))).toBeNull();
    expect(await loadCelebrationMemory()).toEqual(seeded);
  });
});

describe("nextLocalMidnight", () => {
  it("is the coming 00:00 on the device clock, not 24 hours on", () => {
    const end = nextLocalMidnight(new Date(2026, 8, 11, 23, 30));
    expect(end).toEqual(new Date(2026, 8, 12, 0, 0));
    expect(nextLocalMidnight(new Date(2026, 8, 11, 0, 5))).toEqual(new Date(2026, 8, 12, 0, 0));
  });
});
