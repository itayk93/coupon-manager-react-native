import { describe, expect, it } from "vitest";
import {
  amountCents,
  findExistingUsageMatch,
  normalizeUsagePlaceKey,
  usageMinuteBucket,
} from "./usageDuplicateMatch";

describe("normalizeUsagePlaceKey", () => {
  it("lowercases, collapses whitespace and punctuation", () => {
    expect(normalizeUsagePlaceKey("Cafe  Dizengoff, Tel-Aviv")).toBe("cafe dizengoff tel aviv");
  });

  it("falls back to the address when the name is blank", () => {
    expect(normalizeUsagePlaceKey("  ", "הצפירה 23, תל אביב")).toBe("הצפירה 23 תל אביב");
  });

  it("returns an empty key when nothing is provided", () => {
    expect(normalizeUsagePlaceKey(null, null)).toBe("");
  });
});

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
      place_address: "הצפירה 23, תל אביב-יפו",
      timestamp: "2026-08-19T13:41:00+03:00",
    },
  ];

  it("matches on amount + place + minute", () => {
    const hit = findExistingUsageMatch(
      { amount: 40, placeName: "בית ארקפה", usedAt: "2026-08-19T13:41:12+03:00" },
      existing
    );
    expect(hit).toBe(existing[0]);
  });

  it("matches via the address when the detected name differs", () => {
    const hit = findExistingUsageMatch(
      {
        amount: 40,
        placeName: "",
        placeAddress: "הצפירה 23 תל אביב-יפו",
        usedAt: "2026-08-19T13:41:00+03:00",
      },
      [{ ...existing[0], place_name: null }]
    );
    expect(hit).not.toBeNull();
  });

  it("does not match a different amount", () => {
    expect(
      findExistingUsageMatch(
        { amount: 41, placeName: "בית ארקפה", usedAt: "2026-08-19T13:41:00+03:00" },
        existing
      )
    ).toBeNull();
  });

  it("does not match a different minute", () => {
    expect(
      findExistingUsageMatch(
        { amount: 40, placeName: "בית ארקפה", usedAt: "2026-08-19T13:45:00+03:00" },
        existing
      )
    ).toBeNull();
  });

  it("never matches when the detected row has no timestamp", () => {
    expect(
      findExistingUsageMatch({ amount: 40, placeName: "בית ארקפה", usedAt: null }, existing)
    ).toBeNull();
  });
});

describe("amountCents", () => {
  it("rounds floating point noise", () => {
    expect(amountCents(40.1)).toBe(4010);
    expect(amountCents(0.1 + 0.2)).toBe(30);
  });
});
