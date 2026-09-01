import { describe, expect, it } from "vitest";
import {
  cardExpiryToExpiration,
  extractCardExpiry,
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
});
