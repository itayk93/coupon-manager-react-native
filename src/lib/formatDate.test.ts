import { describe, expect, it } from "vitest";
import { formatDateShort, formatDateHebrew, daysUntil } from "./formatDate";

describe("formatDateShort", () => {
  it("renders dd/mm/yyyy", () => {
    expect(formatDateShort("2026-08-12")).toBe("12/08/2026");
  });

  it("keeps invalid input as-is", () => {
    expect(formatDateShort("not-a-date")).toBe("not-a-date");
    expect(formatDateShort(null)).toBeNull();
  });
});

describe("formatDateHebrew", () => {
  it("returns the placeholder for a missing date", () => {
    expect(formatDateHebrew(null)).toBe("ללא תוקף");
  });

  it("uses the Hebrew locale for a valid date", () => {
    expect(formatDateHebrew("2026-08-12")).toBe("12.08.2026");
  });
});

describe("daysUntil", () => {
  it("is negative when the date is already past", () => {
    expect(daysUntil("2000-01-01")).toBeLessThan(0);
  });

  it("returns null for missing or invalid dates", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil("garbage")).toBeNull();
  });
});
