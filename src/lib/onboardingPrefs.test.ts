import { describe, expect, it } from "vitest";
import { estimateAnnualSavings } from "./onboardingPrefs";

describe("estimateAnnualSavings", () => {
  it("scales with how many coupons the user said they handle", () => {
    expect(estimateAnnualSavings("few", 30)).toBe(360);
    expect(estimateAnnualSavings("some", 30)).toBe(1080);
    expect(estimateAnnualSavings("many", 30)).toBe(2160);
  });

  it("falls back to a nominal per-coupon saving when the coupon has none", () => {
    // A coupon bought at face value saves nothing yet, and a projection of
    // "0 ₪ a year" is worse than no projection at all.
    expect(estimateAnnualSavings("some", 0)).toBe(900);
    expect(estimateAnnualSavings(undefined, 0)).toBe(300);
  });
});
