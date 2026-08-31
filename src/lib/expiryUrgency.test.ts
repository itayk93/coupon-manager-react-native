import { describe, expect, it } from "vitest";
import { expiryEmphasis, showsMascot } from "./expiryUrgency";

describe("expiryEmphasis", () => {
  it("stays completely still for anything more than three days out", () => {
    for (const days of [4, 5, 7, 14, 30]) {
      expect(expiryEmphasis(days)).toBe("static");
    }
  });

  it("plays the one-off peek at two and three days", () => {
    expect(expiryEmphasis(3)).toBe("peek");
    expect(expiryEmphasis(2)).toBe("peek");
  });

  it("breathes only inside 48 hours — today and tomorrow", () => {
    expect(expiryEmphasis(1)).toBe("breathing");
    expect(expiryEmphasis(0)).toBe("breathing");
  });

  it("treats an already-expired coupon as the most urgent, not the least", () => {
    expect(expiryEmphasis(-1)).toBe("breathing");
  });

  it("falls back to silence when the count is missing", () => {
    expect(expiryEmphasis(null)).toBe("static");
    expect(expiryEmphasis(undefined)).toBe("static");
    expect(expiryEmphasis(Number.NaN)).toBe("static");
  });
});

describe("showsMascot", () => {
  it("keeps the mascot out of the quiet banner", () => {
    expect(showsMascot("static")).toBe(false);
  });

  it("brings it in once there is something to point at", () => {
    expect(showsMascot("peek")).toBe(true);
    expect(showsMascot("breathing")).toBe(true);
  });
});
