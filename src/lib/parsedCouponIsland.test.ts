import { describe, expect, it } from "vitest";
import type { ParsedCoupon } from "@/hooks/useCouponAI";
import { parsedCouponIsland } from "./parsedCouponIsland";

const coupon = (overrides: Partial<ParsedCoupon> = {}): ParsedCoupon => ({
  company: "שופרסל",
  code: "12345678",
  value: 200,
  cost: 180,
  expiration: "2027-03-12",
  description: null,
  cvv: null,
  card_exp: null,
  ...overrides,
});

describe("parsedCouponIsland", () => {
  it("names the company, the amount and the expiry", () => {
    expect(parsedCouponIsland(coupon())).toEqual({
      title: "זיהינו קופון של שופרסל",
      message: "⁦₪ 200⁩ · בתוקף עד 12/03/2027",
    });
  });

  it("keeps agorot on an amount that has them", () => {
    expect(parsedCouponIsland(coupon({ value: 199.9, expiration: null })).message).toBe(
      "⁦₪ 199.90⁩",
    );
  });

  it("falls back to a generic title and a nudge when only the code was read", () => {
    expect(parsedCouponIsland(coupon({ company: " ", value: null, expiration: null }))).toEqual({
      title: "זיהינו קופון",
      message: "בדקו את הפרטים ושמרו",
    });
  });

  it("says how many were found when only the first is opened", () => {
    expect(parsedCouponIsland(coupon({ expiration: null }), 3)).toEqual({
      title: "זיהינו 3 קופונים",
      message: "פתחנו את הראשון: שופרסל · ⁦₪ 200⁩",
    });
  });
});
