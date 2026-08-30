import { beforeEach, describe, expect, it } from "vitest";
import { cacheParsedUsage, clearParsedUsageCache, getCachedParsedUsage } from "./usageParseCache";
import type { ParsedUsageScreenshot } from "@/hooks/useUsageAI";

const parsed = (code: string | null): ParsedUsageScreenshot => ({
  couponCode: code,
  couponCodeConfidence: code ? 0.99 : 0,
  companyName: "BUYME ALL",
  warnings: [],
  usages: [
    { id: "u1", amount: 15, placeName: "ארקפה - מידטאון", usedAt: "2026-08-30T10:06:00+03:00", details: "", placeAddress: "", latitude: null, longitude: null },
  ],
});

describe("usage parse cache", () => {
  beforeEach(() => clearParsedUsageCache());

  it("returns the stored result for the same import id", () => {
    cacheParsedUsage("import-1", parsed("9376-1104-0711-1925"));
    expect(getCachedParsedUsage("import-1")?.couponCode).toBe("9376-1104-0711-1925");
  });

  it("misses for unknown ids and empty keys", () => {
    cacheParsedUsage("", parsed("1"));
    expect(getCachedParsedUsage("other")).toBeNull();
    expect(getCachedParsedUsage("")).toBeNull();
  });

  it("expires entries after 10 minutes", () => {
    cacheParsedUsage("import-1", parsed("1234"), 0);
    expect(getCachedParsedUsage("import-1", 10 * 60 * 1000)).not.toBeNull();
    expect(getCachedParsedUsage("import-1", 10 * 60 * 1000 + 1)).toBeNull();
  });

  it("keeps at most 3 entries, dropping the oldest", () => {
    for (const key of ["a", "b", "c", "d"]) cacheParsedUsage(key, parsed(key));
    expect(getCachedParsedUsage("a")).toBeNull();
    expect(getCachedParsedUsage("d")?.couponCode).toBe("d");
  });
});
