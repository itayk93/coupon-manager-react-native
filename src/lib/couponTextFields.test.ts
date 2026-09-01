import { describe, expect, it } from "vitest";
import {
  cardExpiryToExpiration,
  extractCardExpiry,
  extractRedemptionUrl,
  extractRelativeExpiration,
  isActivationOffer,
  extractVerificationCode,
  extractVoucherCode,
} from "./couponTextFields";

describe("coupon text card fields", () => {
  const directInsuranceMessage = `
    קוד: 9376-7601-8240-4794,
    קוד אימות: 643,
    תוקף: 09/31
  `;

  it("extracts prepaid-card details from a Direct Insurance message", () => {
    expect(extractVoucherCode(directInsuranceMessage)).toBe("9376-7601-8240-4794");
    expect(extractVerificationCode(directInsuranceMessage)).toBe("643");
    expect(extractCardExpiry(directInsuranceMessage)).toBe("09/31");
    expect(cardExpiryToExpiration("09/31")).toBe("2031-09-30");
  });

  it("leaves card details empty when labels are absent", () => {
    expect(extractVerificationCode("שובר בשווי 50 ₪")).toBeNull();
    expect(extractCardExpiry("בתוקף עד 25/06/2031")).toBeNull();
  });

  it("supports common English security-code labels", () => {
    expect(extractVerificationCode("CVV: 927")).toBe("927");
    expect(extractVerificationCode("CVC 1234")).toBe("1234");
  });

  it("ignores hidden RTL formatting characters in labels", () => {
    expect(extractVerificationCode("קוד\u200f \u200eאימות: 643")).toBe("643");
    expect(extractCardExpiry("תוקף\u200f: 09/31")).toBe("09/31");
  });

  it("uses the real last day of the expiry month", () => {
    expect(cardExpiryToExpiration("02/28")).toBe("2028-02-29");
    expect(cardExpiryToExpiration("02/29")).toBe("2029-02-28");
  });

  it("extracts the merchant-list URL instead of the balance URL", () => {
    const text = `לרשימת העסקים המכבדים את שובר FOOD.STYLE:\n[https://food.style.co.il/](https://food.style.co.il/)\nלבדיקת יתרת השובר: https://multipass.co.il/GetBalance`;
    expect(extractRedemptionUrl(text)).toBe("https://food.style.co.il/");
  });

  it("turns a relative validity period into an absolute expiration date", () => {
    expect(
      extractRelativeExpiration("תוקף השובר: 5 שנים.", new Date("2026-09-01T00:00:00Z"))
    ).toBe("2031-09-01");
    expect(extractRelativeExpiration("אין תוקף מצוין")).toBeNull();
  });

  it("recognizes an activation-only birthday offer and expires it at month end", () => {
    const sms = `יום הולדת שמח מ-Babka. מתנה תקף בחודש הקלנדרי של יום ההולדת. להסרה יש לשלוח 508 למספר 0529990043`;
    expect(isActivationOffer(sms)).toBe(true);
    expect(extractRelativeExpiration(sms, new Date("2026-09-01T07:00:00+03:00"))).toBe("2026-09-30");
  });
});
