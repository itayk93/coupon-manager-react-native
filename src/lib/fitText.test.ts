import { describe, expect, it } from "vitest";
import { fitFontSize } from "./fitText";

describe("fitFontSize", () => {
  it("keeps the full size when the line already fits", () => {
    expect(fitFontSize(30, 400)).toBe(13);
  });

  it("shrinks a long headline rather than letting it overflow", () => {
    const size = fitFontSize(60, 230);
    expect(size).toBeLessThan(13);
    expect(size).toBeGreaterThanOrEqual(9);
  });

  it("never drops below the floor, where truncation is kinder than a squint", () => {
    expect(fitFontSize(400, 200)).toBe(9);
  });

  it("moves in half points, so the line does not jitter", () => {
    const size = fitFontSize(45, 240);
    expect(size * 2).toBe(Math.round(size * 2));
  });

  it("assumes the full size until the first layout reports a width", () => {
    expect(fitFontSize(60, 0)).toBe(13);
    expect(fitFontSize(60, Number.NaN)).toBe(13);
  });

  it("returns the full size for an empty headline", () => {
    expect(fitFontSize(0, 300)).toBe(13);
  });

  it("gives a longer headline no more room than a shorter one", () => {
    expect(fitFontSize(70, 230)).toBeLessThanOrEqual(fitFontSize(40, 230));
  });
});
