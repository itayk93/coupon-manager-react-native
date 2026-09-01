import { describe, expect, it } from "vitest";
import { getSharedCouponImport, storeSharedCouponImport } from "./sharedCouponImport";

describe("shared coupon import handoff", () => {
  it("preserves CVV and card expiry without URL params", () => {
    storeSharedCouponImport("import-1", {
      company: "גוד פארם",
      code: "9376-7601-8240-4794",
      value: 100,
      cost: null,
      expiration: "2031-09-30",
      description: null,
      cvv: "643",
      card_exp: "09/31",
      redemption_url: "https://food.style.co.il/",
    });

    expect(getSharedCouponImport("import-1")).toMatchObject({
      cvv: "643",
      card_exp: "09/31",
      expiration: "2031-09-30",
    });
  });
});
