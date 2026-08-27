import { describe, expect, it } from "vitest";
import {
  PENDING_REFERRAL_TTL_MS,
  isPendingReferralFresh,
  normalizeReferralCode,
  referralCodeFromPath,
  referralShareMessage,
  referralUrl,
} from "./referral";

const BASE = "https://coupons.itaykarkason.com";

describe("referral codes", () => {
  it("accepts a code however it was typed or pasted", () => {
    expect(normalizeReferralCode("elior")).toBe("ELIOR");
    expect(normalizeReferralCode("  Elior \n")).toBe("ELIOR");
    expect(normalizeReferralCode("D7K4QW")).toBe("D7K4QW");
  });

  it("refuses anything that cannot be a code", () => {
    expect(normalizeReferralCode(undefined)).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode("ab")).toBeNull();
    expect(normalizeReferralCode("../../etc/passwd")).toBeNull();
    expect(normalizeReferralCode("ELI OR")).toBeNull();
    expect(normalizeReferralCode("E".repeat(25))).toBeNull();
  });

  it("builds the link the share sheet sends", () => {
    expect(referralUrl(BASE, "ELIOR")).toBe(`${BASE}/r/ELIOR`);
    expect(referralUrl(`${BASE}/`, "ELIOR")).toBe(`${BASE}/r/ELIOR`);
    expect(referralShareMessage(BASE, "ELIOR")).toContain(`${BASE}/r/ELIOR`);
  });

  it("reads the code back out of every shape a link arrives in", () => {
    expect(referralCodeFromPath(`${BASE}/r/ELIOR`)).toBe("ELIOR");
    expect(referralCodeFromPath("couponmaster:///r/d7k4qw")).toBe("D7K4QW");
    expect(referralCodeFromPath(`${BASE}/r/ELIOR?utm_source=whatsapp`)).toBe("ELIOR");
    expect(referralCodeFromPath("ELIOR")).toBe("ELIOR");
    expect(referralCodeFromPath(`${BASE}/coupons`)).toBeNull();
    expect(referralCodeFromPath(null)).toBeNull();
  });
});

describe("a code waiting on the device", () => {
  const now = 1_800_000_000_000;

  it("is used while it is fresh", () => {
    expect(isPendingReferralFresh({ code: "ELIOR", savedAt: now - 60_000 }, now)).toBe(true);
  });

  it("expires rather than attributing a user who arrived weeks later", () => {
    expect(
      isPendingReferralFresh({ code: "ELIOR", savedAt: now - PENDING_REFERRAL_TTL_MS - 1 }, now)
    ).toBe(false);
  });

  it("does not treat a clock that jumped backwards as extra time", () => {
    expect(isPendingReferralFresh({ code: "ELIOR", savedAt: now + 60_000 }, now)).toBe(false);
  });

  it("has nothing to claim when nothing was saved", () => {
    expect(isPendingReferralFresh(null, now)).toBe(false);
  });
});
