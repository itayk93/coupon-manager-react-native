import { describe, expect, it } from "vitest";
import { EXPIRY_PERFORMANCE, expiryEmphasis, expiryLevel, type ExpiryLevel } from "./expiryUrgency";

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

describe("expiryLevel", () => {
  it("names the same four steps the emphasis ladder uses", () => {
    expect(expiryLevel(0)).toBe("alarm");
    expect(expiryLevel(1)).toBe("alarm");
    expect(expiryLevel(2)).toBe("worry");
    expect(expiryLevel(3)).toBe("worry");
    expect(expiryLevel(4)).toBe("watch");
    expect(expiryLevel(7)).toBe("watch");
    expect(expiryLevel(8)).toBe("none");
  });

  it("stays calm when there is no date to worry about", () => {
    expect(expiryLevel(null)).toBe("none");
    expect(expiryLevel(undefined)).toBe("none");
    expect(expiryLevel(Number.NaN)).toBe("none");
  });

  // The face and the motion are one escalation. If these ever disagree the
  // mascot looks worried while the banner sits still, or the reverse.
  it("moves in step with expiryEmphasis", () => {
    for (const days of [0, 1, 2, 3, 4, 7, 8, 30]) {
      const level = expiryLevel(days);
      const emphasis = expiryEmphasis(days);
      if (level === "alarm") expect(emphasis).toBe("breathing");
      if (level === "worry") expect(emphasis).toBe("peek");
      if (level === "watch" || level === "none") expect(emphasis).toBe("static");
    }
  });

  // Each rung is its own drawn loop. Two rungs sharing one would be the old
  // bug back: a ladder the code promises and the artwork cannot show.
  it("gives every rung a face of its own", () => {
    const order: ExpiryLevel[] = ["none", "watch", "worry", "alarm"];
    const states = order.map((level) => EXPIRY_PERFORMANCE[level].state);
    expect(new Set(states).size).toBe(order.length);
  });

  it("leaves playback speed alone now that the faces carry the escalation", () => {
    for (const level of ["none", "watch", "worry", "alarm"] as ExpiryLevel[]) {
      expect(EXPIRY_PERFORMANCE[level].speed).toBe(1);
    }
  });
});
