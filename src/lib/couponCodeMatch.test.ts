import { describe, expect, it } from "vitest";
import { matchCouponCode, normalizeCouponCode } from "./couponCodeMatch";

const coupon = (id: number, code: string) => ({ id, code, status: "פעיל" }) as any;

describe("coupon code matching", () => {
  it("normalizes separators", () => expect(normalizeCouponCode("9376-1104 0711" )).toBe("937611040711"));
  it("matches the BuyMe code shown with and without separators", () => expect(
    matchCouponCode("9376-1159-9259-8998", [coupon(1, "9376115992598998")])
  ).toMatchObject({ kind: "exact", coupon: { id: 1 } }));
  it("matches one exact code", () => expect(matchCouponCode("12-34", [coupon(1, "1234")])).toMatchObject({ kind: "exact", coupon: { id: 1 } }));
  it("never guesses between duplicates", () => expect(matchCouponCode("1234", [coupon(1, "1234"), coupon(2, "12-34")]).kind).toBe("ambiguous"));
  it("allows a unique visible suffix", () => expect(matchCouponCode("0711", [coupon(1, "937611040711")])).toMatchObject({ kind: "partial" }));
  it("allows one unique OCR digit error", () => expect(
    matchCouponCode("9376-1159-9259-899B", [coupon(1, "9376115992598998")])
  ).toMatchObject({ kind: "partial", coupon: { id: 1 } }));
  it("allows one adjacent OCR transposition", () => expect(
    matchCouponCode("9376-1159-9259-8989", [coupon(1, "9376115992598998")])
  ).toMatchObject({ kind: "partial", coupon: { id: 1 } }));
  it("never guesses when an OCR-tolerant match is not unique", () => expect(
    matchCouponCode("937611599259899B", [coupon(1, "9376115992598998"), coupon(2, "9376115992598999")]).kind
  ).toBe("ambiguous"));
});
