import { describe, expect, it } from "vitest";
import { isMerchantQuery } from "./useCouponMerchantSearch";

describe("isMerchantQuery", () => {
  it("accepts Hebrew and English store names", () => {
    expect(isMerchantQuery("לגו")).toBe(true);
    expect(isMerchantQuery("LEGO")).toBe(true);
  });

  it("does not send numeric coupon searches to GPT", () => {
    expect(isMerchantQuery("9376112130070964")).toBe(false);
    expect(isMerchantQuery(" ")).toBe(false);
  });
});
