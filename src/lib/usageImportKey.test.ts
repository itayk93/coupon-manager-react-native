import { describe, expect, it } from "vitest";
import { createUsageIntentKeyHolder, makeUsageImportKey } from "./usageImportKey";

describe("makeUsageImportKey", () => {
  it("defaults to the manual prefix", () => {
    expect(makeUsageImportKey().startsWith("manual-")).toBe(true);
  });

  it("keeps a caller-supplied prefix", () => {
    expect(makeUsageImportKey("import-42").startsWith("import-42-")).toBe(true);
  });

  it("never repeats across many generations", () => {
    const keys = new Set(Array.from({ length: 1000 }, () => makeUsageImportKey()));
    expect(keys.size).toBe(1000);
  });

  it("always meets the server minimum length of 8", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(makeUsageImportKey().length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("createUsageIntentKeyHolder", () => {
  it("returns the same key across attempts of one intent (retry, double tap)", () => {
    const holder = createUsageIntentKeyHolder();
    const first = holder.get();
    expect(holder.get()).toBe(first);
    expect(holder.get()).toBe(first);
  });

  it("mints a fresh key after reset, so a distinct submission is not deduped", () => {
    const holder = createUsageIntentKeyHolder();
    const first = holder.get();
    holder.reset();
    const second = holder.get();
    expect(second).not.toBe(first);
    expect(holder.get()).toBe(second);
  });

  it("keeps holders independent of each other", () => {
    const a = createUsageIntentKeyHolder();
    const b = createUsageIntentKeyHolder();
    expect(a.get()).not.toBe(b.get());
  });
});
