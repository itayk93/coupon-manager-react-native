import { describe, expect, it } from "vitest";
import {
  ACTIVITY_ACTIONS,
  isActivityAction,
  sanitizeCouponId,
  sanitizeMetadata,
} from "../../supabase/functions/_shared/activityEvents";

/**
 * The activity log is the table most likely to be exported to a spreadsheet,
 * shared with someone, and kept forever. What it must never contain is a
 * coupon code — and "we were careful at the call sites" is not a guarantee,
 * because the next call site has not been written yet.
 *
 * These tests pin the scrubbing that runs on the server, where a caller
 * cannot opt out of it.
 */

describe("sanitizeMetadata drops anything sensitive", () => {
  it("removes a coupon code however it is spelled", () => {
    expect(
      sanitizeMetadata({ code: "1234-5678", coupon_code: "x", couponCode: "y", CODE: "z" })
    ).toBeNull();
  });

  it("removes card, password, token, secret, email and phone fields", () => {
    expect(
      sanitizeMetadata({
        cvv: "123",
        card_exp: "08/28",
        password: "hunter2",
        access_token: "ey...",
        client_secret: "s",
        email: "someone@example.com",
        phone_number: "050-0000000",
      })
    ).toBeNull();
  });

  it("keeps the harmless fields alongside the removed ones", () => {
    expect(sanitizeMetadata({ company: "VANS", code: "SECRET", amount: 50 })).toEqual({
      company: "VANS",
      amount: 50,
    });
  });
});

describe("sanitizeMetadata bounds what it stores", () => {
  it("keeps only short primitives", () => {
    expect(
      sanitizeMetadata({
        screen: "/coupons/42",
        count: 3,
        expanded: true,
        nested: { a: 1 },
        list: [1, 2, 3],
        nothing: null,
      })
    ).toEqual({ screen: "/coupons/42", count: 3, expanded: true });
  });

  it("truncates a long string rather than storing it whole", () => {
    const value = sanitizeMetadata({ note: "x".repeat(1000) });
    expect(value?.note).toHaveLength(200);
  });

  it("caps the number of keys", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`k${i}`, i])
    );
    expect(Object.keys(sanitizeMetadata(wide) || {})).toHaveLength(12);
  });

  it("drops blank strings and non-finite numbers", () => {
    expect(sanitizeMetadata({ a: "   ", b: NaN, c: Infinity })).toBeNull();
  });

  it("returns null rather than an empty object", () => {
    expect(sanitizeMetadata({})).toBeNull();
    expect(sanitizeMetadata(null)).toBeNull();
    expect(sanitizeMetadata("nope")).toBeNull();
    expect(sanitizeMetadata([1, 2])).toBeNull();
  });
});

describe("isActivityAction", () => {
  it("accepts every action in the shared vocabulary", () => {
    for (const action of ACTIVITY_ACTIONS) {
      expect(isActivityAction(action)).toBe(true);
    }
  });

  it("rejects anything else, so a forged batch stores nothing", () => {
    expect(isActivityAction("drop_table")).toBe(false);
    expect(isActivityAction("")).toBe(false);
    expect(isActivityAction(42)).toBe(false);
    expect(isActivityAction(undefined)).toBe(false);
  });

  it("keeps the names the old web app already wrote", () => {
    // 30k rows of history are keyed on these; renaming one strands them.
    for (const legacy of ["page_access", "view_coupon", "login_success", "mark_coupon_as_used"]) {
      expect(isActivityAction(legacy)).toBe(true);
    }
  });
});

describe("sanitizeCouponId", () => {
  it("accepts a positive integer", () => {
    expect(sanitizeCouponId(42)).toBe(42);
    expect(sanitizeCouponId("42")).toBe(42);
  });

  it("refuses anything else", () => {
    expect(sanitizeCouponId(0)).toBeNull();
    expect(sanitizeCouponId(-1)).toBeNull();
    expect(sanitizeCouponId(1.5)).toBeNull();
    expect(sanitizeCouponId("abc")).toBeNull();
    expect(sanitizeCouponId(null)).toBeNull();
    expect(sanitizeCouponId(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
  });
});
