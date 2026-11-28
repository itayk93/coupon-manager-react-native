import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DecryptedCoupon } from "@/types/coupon";
import { giftValueUsed, realizedSavings, spendEvents } from "./couponSavings";
import { remainingAfterUsage } from "./couponTotals";
import { nearbyCoupon } from "./nearbyCoupon";

// Stored spending is stale (0); the ledger says 44 of 100 was spent.
const stale = {
  id: 1, public_id: "c1", company: "BuyMe", value: 100, cost: 80, used_value: 0,
  ledger_used_value: 44, status: "פעיל", expiration: null, date_added: "2026-01-01T00:00:00Z",
} as unknown as DecryptedCoupon;

describe("ledger spending reaches every balance consumer", () => {
  it("counts ledger spending in savings", () => {
    expect(realizedSavings(stale)).toBeCloseTo(8.8);
    expect(giftValueUsed({ ...stale, cost: 0 })).toBe(44);
    expect(spendEvents(stale, [], [])).toEqual([{ at: Date.parse(stale.date_added!), amount: 44 }]);
  });

  it("offers the ledger balance for a nearby coupon", () => {
    const here = { latitude: 32, longitude: 34 };
    const places = [{ ...here, id: "p", name: "shop", transactions: [{ couponId: 1 }] }];
    expect(nearbyCoupon(here, places, [stale], "2026-11-28")?.remaining).toBe(56);
    expect(nearbyCoupon(here, places, [{ ...stale, ledger_used_value: 100 }], "2026-11-28")).toBeNull();
  });

  it("subtracts a new usage from the ledger balance when the stored total trails", () => {
    expect(remainingAfterUsage(stale, 10, 10)).toBe(46);
    expect(remainingAfterUsage({ ...stale, ledger_used_value: 0 }, 10, 10)).toBe(90);
    // Part of a batch was skipped, so the added amount is unknown.
    expect(remainingAfterUsage(stale, 10, null)).toBe(56);
  });

  it("no screen or component reads stored spending directly", () => {
    const root = join(__dirname, "..");
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
      });
    const offenders = [...files(join(root, "screens")), ...files(join(root, "components"))].filter((path) =>
      /\.used_value\b/.test(readFileSync(path, "utf8"))
    );
    expect(offenders.map((path) => path.slice(root.length + 1))).toEqual([]);
  });
});
