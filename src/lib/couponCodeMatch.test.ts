import { describe, expect, it } from "vitest";
import { matchCouponCode, normalizeCouponCode } from "./couponCodeMatch";

const coupon = (id: number, code: string) => ({ id, code, status: "פעיל" }) as any;

describe("coupon code matching", () => {
  it("normalizes separators", () => expect(normalizeCouponCode("9376-1104 0711" )).toBe("937611040711"));
  it("matches one exact code", () => expect(matchCouponCode("12-34", [coupon(1, "1234")])).toMatchObject({ kind: "exact", coupon: { id: 1 } }));
  it("never guesses between duplicates", () => expect(matchCouponCode("1234", [coupon(1, "1234"), coupon(2, "12-34")]).kind).toBe("ambiguous"));
  it("allows a unique visible suffix", () => expect(matchCouponCode("0711", [coupon(1, "937611040711")])).toMatchObject({ kind: "partial" }));
});
