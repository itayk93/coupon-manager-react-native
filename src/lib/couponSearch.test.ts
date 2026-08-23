import { describe, expect, it } from "vitest";
import { matchesCouponSearch } from "./couponSearch";

const coupon = {
  company: "מגה ספורט",
  description: "מתנת יום הולדת",
  code: "1146-6813 91097",
};

describe("matchesCouponSearch", () => {
  it("finds a decrypted coupon number without issuer formatting", () => {
    expect(matchesCouponSearch(coupon, "1146681391097")).toBe(true);
  });

  it("finds a partial coupon number with different formatting", () => {
    expect(matchesCouponSearch(coupon, "6813-910")).toBe(true);
  });

  it("keeps company and description search", () => {
    expect(matchesCouponSearch(coupon, "מגה")).toBe(true);
    expect(matchesCouponSearch(coupon, "יום הולדת")).toBe(true);
  });

  it("does not match a different coupon number", () => {
    expect(matchesCouponSearch(coupon, "999999")).toBe(false);
  });
});
