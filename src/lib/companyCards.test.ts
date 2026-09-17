import { describe, expect, it } from "vitest";
import { companyCards } from "./companyCards";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

let nextId = 1;
function coupon(company: string | null): DecryptedCoupon {
  return {
    id: nextId++,
    company,
    value: 100,
    used_value: 0,
    status: "פעיל",
    expiration: null,
  } as DecryptedCoupon;
}

const names = (coupons: DecryptedCoupon[], usage?: Parameters<typeof companyCards>[1]) =>
  companyCards(coupons, usage).map((card) => card.company);

describe("companyCards", () => {
  it("counts a company once however it was typed", () => {
    const cards = companyCards([coupon("GoodPharm"), coupon("goodpharm "), coupon("BuyMe")]);
    expect(cards).toEqual([
      { company: "GoodPharm", count: 2 },
      { company: "BuyMe", count: 1 },
    ]);
  });

  it("shows the name the first of them carries", () => {
    expect(names([coupon("סופר פארם"), coupon("סופר-פארם")])).toEqual(["סופר פארם"]);
  });

  it("names a company-less coupon rather than leaving the tile blank", () => {
    expect(names([coupon(null), coupon("")])).toEqual(["ללא חברה"]);
  });

  it("puts the most recently used company first", () => {
    const wallet = [coupon("BuyMe"), coupon("Babka"), coupon("GoodPharm")];
    expect(names(wallet, { latestUsageByCompany: { Babka: 500, BuyMe: 100 } })).toEqual([
      "Babka",
      "BuyMe",
      "GoodPharm",
    ]);
  });

  it("falls to how often, then how many, then the alphabet", () => {
    const wallet = [coupon("BuyMe"), coupon("Babka"), coupon("Babka"), coupon("Aroma")];
    // Nothing used: Babka leads on two coupons, then the two singles in order.
    expect(names(wallet)).toEqual(["Babka", "Aroma", "BuyMe"]);
    // Used once, BuyMe outranks the bigger pile.
    expect(names(wallet, { usageCountByCompany: { BuyMe: 1 } })).toEqual([
      "BuyMe",
      "Babka",
      "Aroma",
    ]);
  });

  it("does not reshuffle a wallet nothing has been spent from", () => {
    const wallet = [coupon("ג"), coupon("א"), coupon("ב")];
    expect(names(wallet)).toEqual(names(wallet));
    expect(names(wallet)).toEqual(["א", "ב", "ג"]);
  });

  it("has no opinion about an empty wallet", () => {
    expect(companyCards([])).toEqual([]);
  });
});
