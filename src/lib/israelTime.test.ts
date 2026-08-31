import { describe, expect, it } from "vitest";
import { formatIsraelDateTime, parseIsraelDateTime } from "./formatDate";

describe("formatIsraelDateTime", () => {
  it("renders an offset timestamp as Israeli wall clock", () => {
    expect(formatIsraelDateTime("2026-06-23T22:29:00+03:00")).toBe("23/06/2026 22:29");
  });

  it("converts a UTC timestamp into Israel summer time", () => {
    expect(formatIsraelDateTime("2026-06-23T19:29:00Z")).toBe("23/06/2026 22:29");
  });

  it("converts a UTC timestamp into Israel winter time", () => {
    expect(formatIsraelDateTime("2026-01-15T19:29:00Z")).toBe("15/01/2026 21:29");
  });

  it("does not read a device in another timezone as another day", () => {
    // 00:30 in Israel is still the previous evening in UTC.
    expect(formatIsraelDateTime("2026-06-23T21:30:00Z")).toBe("24/06/2026 00:30");
  });

  it("returns null for nothing and for junk", () => {
    expect(formatIsraelDateTime(null)).toBeNull();
    expect(formatIsraelDateTime("")).toBeNull();
    expect(formatIsraelDateTime("not a date")).toBeNull();
  });
});

describe("parseIsraelDateTime", () => {
  it("round-trips what the field shows", () => {
    const iso = parseIsraelDateTime("23/06/2026 22:29");
    expect(iso).not.toBeNull();
    expect(formatIsraelDateTime(iso)).toBe("23/06/2026 22:29");
  });

  it("reads summer time as +03:00", () => {
    expect(parseIsraelDateTime("23/06/2026 22:29")).toBe("2026-06-23T19:29:00.000Z");
  });

  it("reads winter time as +02:00", () => {
    expect(parseIsraelDateTime("15/01/2026 21:29")).toBe("2026-01-15T19:29:00.000Z");
  });

  it("accepts a single-digit day and hour", () => {
    expect(formatIsraelDateTime(parseIsraelDateTime("3/06/2026 9:05"))).toBe("03/06/2026 09:05");
  });

  it("rejects a date that does not exist instead of rolling it over", () => {
    expect(parseIsraelDateTime("31/02/2026 10:00")).toBeNull();
    expect(parseIsraelDateTime("32/01/2026 10:00")).toBeNull();
    expect(parseIsraelDateTime("01/13/2026 10:00")).toBeNull();
    expect(parseIsraelDateTime("01/01/2026 25:00")).toBeNull();
  });

  it("rejects a half-typed value", () => {
    for (const bad of ["", "23/06/2026", "23/06/26 22:29", "22:29", null]) {
      expect(parseIsraelDateTime(bad)).toBeNull();
    }
  });
});
