import { describe, expect, it } from "vitest";
import {
  buildCouponPayload,
  findDuplicateCoupons,
  getDefaultAutoProvider,
  normalizeAutoProvider,
  normalizeCouponCode,
  validateCouponForm,
  type CouponFormFields,
} from "./couponForm";

/**
 * Characterization tests: these pin the behaviour the screen had before the
 * form logic was lifted out of it, quirks included. A change here is a change
 * in what the app does, not a tidier way of saying the same thing.
 */

const fields = (overrides: Partial<CouponFormFields> = {}): CouponFormFields => ({
  company: "BuyMe",
  code: "ABC-123",
  value: "100",
  cost: "80",
  expiration: "2026-12-31",
  isOneTime: false,
  purpose: "",
  description: "",
  includeCardInfo: false,
  cvv: "",
  cardExp: "",
  redemptionUrl: "",
  autoProvider: null,
  ...overrides,
});

describe("validateCouponForm", () => {
  it("accepts a filled form", () => {
    expect(validateCouponForm(fields())).toEqual({});
  });

  it("requires company, code and value", () => {
    expect(validateCouponForm(fields({ company: "  ", code: "", value: "" }))).toEqual({
      company: "יש לבחור או להזין חברה",
      code: "קוד קופון הוא שדה חובה",
      value: "יש להזין שווי תקין בש״ח",
    });
  });

  it("rejects a non-numeric or negative value", () => {
    expect(validateCouponForm(fields({ value: "abc" })).value).toBeTruthy();
    expect(validateCouponForm(fields({ value: "-1" })).value).toBeTruthy();
  });

  it("accepts a zero value", () => {
    expect(validateCouponForm(fields({ value: "0" }))).toEqual({});
  });

  it("allows an empty code only for an imported activation offer", () => {
    expect(validateCouponForm(fields({ code: "", value: "0" }), { allowEmptyCode: true })).toEqual({});
    expect(validateCouponForm(fields({ code: "", value: "0" })).code).toBeTruthy();
  });

  it("does not require an expiration date", () => {
    expect(validateCouponForm(fields({ expiration: "" }))).toEqual({});
  });
});

describe("getDefaultAutoProvider", () => {
  it("maps a company name to its scraper, in either language", () => {
    expect(getDefaultAutoProvider("  MULTIPASS ")).toBe("Multipass");
  });

  it("does not offer automatic updates for BuyMe or Max", () => {
    expect(getDefaultAutoProvider("BuyMe Card")).toBeNull();
    expect(getDefaultAutoProvider("ביימי")).toBeNull();
    expect(getDefaultAutoProvider("Max")).toBeNull();
    expect(getDefaultAutoProvider("מקס")).toBeNull();
    expect(normalizeAutoProvider("BuyMe", true)).toBeNull();
    expect(normalizeAutoProvider("Max", true)).toBeNull();
  });

  it("routes Xtra through the Multipass scraper", () => {
    expect(getDefaultAutoProvider("Xtra")).toBe("Multipass");
    expect(getDefaultAutoProvider("אקסטרה")).toBe("Multipass");
  });

  it("returns null for a company nothing can scrape", () => {
    expect(getDefaultAutoProvider("מגה ספורט")).toBeNull();
    expect(getDefaultAutoProvider(null)).toBeNull();
    expect(getDefaultAutoProvider(undefined)).toBeNull();
  });
});

describe("normalizeAutoProvider", () => {
  it("keeps a known provider when the updater is available", () => {
    expect(normalizeAutoProvider("Multipass", true)).toBe("Multipass");
  });

  it("drops an unknown provider", () => {
    expect(normalizeAutoProvider("Groupon", true)).toBeNull();
    expect(normalizeAutoProvider(null, true)).toBeNull();
  });

  it("drops everything when the updater is not available to this account", () => {
    expect(normalizeAutoProvider("BuyMe", false)).toBeNull();
  });
});

describe("normalizeCouponCode", () => {
  it("strips dashes and spaces from a numeric code", () => {
    expect(normalizeCouponCode("9376-1104-0711-1925")).toBe("9376110407111925");
    expect(normalizeCouponCode("  1234 5678 ")).toBe("12345678");
  });

  it("leaves a code with letters as typed, only trimmed", () => {
    expect(normalizeCouponCode("  SUMMER-20  ")).toBe("SUMMER-20");
    expect(normalizeCouponCode("ABC 123")).toBe("ABC 123");
  });
});

describe("findDuplicateCoupons", () => {
  const wallet = [
    { code: "9376110407111925", company: "BuyMe", status: "נוצל" },
    { code: "ABC-123", company: "Max", status: "פעיל" },
  ];

  it("matches a dashed code against a stored bare code", () => {
    expect(findDuplicateCoupons("9376-1104-0711-1925", wallet)).toHaveLength(1);
  });

  it("matches ignoring case and separators", () => {
    expect(findDuplicateCoupons("abc123", wallet)[0].company).toBe("Max");
  });

  it("returns nothing for a new code or an empty code", () => {
    expect(findDuplicateCoupons("0000", wallet)).toEqual([]);
    expect(findDuplicateCoupons("  ", wallet)).toEqual([]);
  });
});

describe("buildCouponPayload", () => {
  it("trims text and turns blanks into null", () => {
    expect(
      buildCouponPayload(
        fields({
          company: "  BuyMe  ",
          code: "  ABC  ",
          expiration: "   ",
          description: "  ",
          redemptionUrl: "  ",
        }),
        false
      )
    ).toMatchObject({
      company: "BuyMe",
      code: "ABC",
      expiration: null,
      description: null,
      buyme_coupon_url: null,
    });
  });

  it("reads value and cost as numbers, defaulting a blank to 0", () => {
    const payload = buildCouponPayload(fields({ value: "12.5", cost: "" }), false);
    expect(payload.value).toBe(12.5);
    expect(payload.cost).toBe(0);
  });

  it("stores one-time status and a trimmed optional purpose", () => {
    expect(
      buildCouponPayload(fields({ isOneTime: true, purpose: "  מתנה ליום הולדת  " }), false)
    ).toMatchObject({
      is_one_time: true,
      purpose: "מתנה ליום הולדת",
    });

    expect(buildCouponPayload(fields({ purpose: "  " }), false)).toMatchObject({
      is_one_time: false,
      purpose: null,
    });
  });

  it("only stores card details while the card switch is on", () => {
    const on = buildCouponPayload(
      fields({ includeCardInfo: true, cvv: " 123 ", cardExp: " 08/28 " }),
      false
    );
    expect(on).toMatchObject({ cvv: "123", card_exp: "08/28" });

    const off = buildCouponPayload(
      fields({ includeCardInfo: false, cvv: "123", cardExp: "08/28" }),
      false
    );
    expect(off).toMatchObject({ cvv: null, card_exp: null });
  });

  it("never stores an auto provider for an account without the updater", () => {
    const payload = buildCouponPayload(fields({ autoProvider: "Multipass" }), false);
    expect(payload).toMatchObject({ auto_download_details: null, auto_update: false });
  });

  it("enables auto_update exactly when a provider is chosen", () => {
    expect(buildCouponPayload(fields({ autoProvider: "Multipass" }), true)).toMatchObject({
      auto_download_details: "Multipass",
      auto_update: true,
    });
    expect(buildCouponPayload(fields({ autoProvider: null }), true)).toMatchObject({
      auto_download_details: null,
      auto_update: false,
    });
  });
});
