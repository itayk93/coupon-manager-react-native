import { describe, expect, it } from "vitest";
import { amountCents, findExistingUsageMatch, usageMinuteBucket } from "./usageDuplicateMatch";

describe("usageMinuteBucket", () => {
  it("truncates to the minute", () => {
    expect(usageMinuteBucket("2026-08-19T13:41:59+03:00")).toBe(
      usageMinuteBucket("2026-08-19T13:41:00+03:00")
    );
  });

  it("separates adjacent minutes", () => {
    expect(usageMinuteBucket("2026-08-19T13:42:00+03:00")).not.toBe(
      usageMinuteBucket("2026-08-19T13:41:00+03:00")
    );
  });

  it("compares absolute time across offsets", () => {
    expect(usageMinuteBucket("2026-08-23T09:19:00+03:00")).toBe(
      usageMinuteBucket("2026-08-23T06:19:00Z")
    );
  });

  it("returns null for missing or invalid input", () => {
    expect(usageMinuteBucket(null)).toBeNull();
    expect(usageMinuteBucket("not a date")).toBeNull();
  });
});

describe("findExistingUsageMatch", () => {
  const existing = [
    {
      transaction_amount: -40,
      place_name: "בית ארקפה",
      timestamp: "2026-08-19T13:41:00+03:00",
    },
  ];

  it("matches on amount + minute", () => {
    const hit = findExistingUsageMatch(
      { amount: 40, usedAt: "2026-08-19T13:41:12+03:00" },
      existing
    );
    expect(hit).toBe(existing[0]);
  });

  it("matches when OCR misread the branch name", () => {
    // The real 2026-08-23 miss: "ארקפה - מידטאון" one screenshot,
    // "ארקפה - מיזטאון" the next, same 15₪ at the same minute.
    const ledger = [{ transaction_amount: -15, timestamp: "2026-08-23T06:19:00Z" }];
    const hit = findExistingUsageMatch(
      { amount: 15, usedAt: "2026-08-23T09:19:00+03:00" },
      ledger
    );
    expect(hit).toBe(ledger[0]);
  });

  it("does not match a different amount", () => {
    expect(
      findExistingUsageMatch({ amount: 41, usedAt: "2026-08-19T13:41:00+03:00" }, existing)
    ).toBeNull();
  });

  it("does not match a different minute", () => {
    expect(
      findExistingUsageMatch({ amount: 40, usedAt: "2026-08-19T13:45:00+03:00" }, existing)
    ).toBeNull();
  });

  it("never matches when the detected row has no timestamp", () => {
    expect(findExistingUsageMatch({ amount: 40, usedAt: null }, existing)).toBeNull();
  });
});

describe("amountCents", () => {
  it("rounds floating point noise", () => {
    expect(amountCents(40.1)).toBe(4010);
    expect(amountCents(0.1 + 0.2)).toBe(30);
  });
});
