import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_TYPES,
  isTypeChannelOn,
  withTypeChannel,
} from "./notificationTypes";
import {
  NOTIFICATION_TYPES as SERVER_TYPES,
  copyFor,
} from "../../supabase/functions/_shared/notificationTypes";

/**
 * The catalogue exists twice — once for the settings screen, once for the edge
 * functions that send — because an edge function cannot import from src/. That
 * duplication is only safe while the two agree, and the way it fails is
 * invisible: a switch that says "off" over a message the server still sends,
 * because one side spells the id differently or defaults it the other way.
 */
describe("client and server catalogues agree", () => {
  it("covers the same kinds", () => {
    expect(NOTIFICATION_TYPES.map((type) => type.id).sort())
      .toEqual(Object.keys(SERVER_TYPES).sort());
  });

  it("defaults each channel the same way", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect({ id: type.id, ...type.defaults })
        .toEqual({ id: type.id, ...SERVER_TYPES[type.id].defaults });
    }
  });
});

describe("isTypeChannelOn", () => {
  it("falls back to the kind's default when nothing is stored", () => {
    // A kind added on the server has to reach people who have never opened the
    // settings screen — otherwise every new kind ships silently off.
    expect(isTypeChannelOn({}, "expiry", "push")).toBe(true);
    expect(isTypeChannelOn(null, "coupon_milestone", "email")).toBe(false);
  });

  it("prefers a stored choice over the default, in both directions", () => {
    expect(isTypeChannelOn({ expiry: { push: false } }, "expiry", "push")).toBe(false);
    expect(isTypeChannelOn({ monthly_summary: { push: true } }, "monthly_summary", "push")).toBe(true);
  });

  it("reads each channel of a kind independently", () => {
    const stored = { expiry: { push: false } };
    expect(isTypeChannelOn(stored, "expiry", "email")).toBe(true);
  });
});

describe("withTypeChannel", () => {
  it("leaves the other kinds and the other channel alone", () => {
    const before = { expiry: { push: false, email: true }, idle_money: { push: true } };
    const after = withTypeChannel(before, "expiry", "email", false);
    expect(after.expiry).toEqual({ push: false, email: false });
    expect(after.idle_money).toEqual({ push: true });
  });

  it("starts a kind that has no entry yet", () => {
    expect(withTypeChannel({}, "idle_money", "email", false))
      .toEqual({ idle_money: { email: false } });
  });
});

describe("copy", () => {
  it("spells the currency out instead of using the sign", () => {
    // The ₪ sign lands on the wrong side of the digits in mail clients and
    // notification shades alike; the letters never do, and they read as speech.
    const copy = copyFor("monthly_summary", { month: 7, year: 2026, amount: 869.8, isBest: true });
    expect(copy.body).toContain("869.80 ש״ח");
    expect(copy.body).toContain("באוגוסט 2026");
    expect(copy.body).not.toContain("₪");
  });

  it("names the sharer and the company", () => {
    const copy = copyFor("share_received", { fromName: "נועה", company: "Wolt" });
    expect(copy.body).toContain("נועה");
    expect(copy.body).toContain("Wolt");
    expect(copy.link).toBe("/sharing");
  });

  it("sends a multi-coupon balance update to the list, a single one to the coupon", () => {
    expect(copyFor("balance_updated", { company: "X", balance: 1, couponId: 7, extra: 0 }).link)
      .toBe("/coupons/7");
    expect(copyFor("balance_updated", { company: "X", balance: 1, couponId: 7, extra: 2 }).link)
      .toBe("/coupons");
  });

  it("points the expired-unused message at the reminder settings", () => {
    // The message asks whether to remind earlier next time; the tap has to land
    // where that can actually be changed.
    expect(copyFor("expired_unused", { company: "קסטרו", remaining: 80 }).link)
      .toBe("/notification-settings");
  });

  it("writes every kind in Hebrew", () => {
    for (const id of Object.keys(SERVER_TYPES) as Array<keyof typeof SERVER_TYPES>) {
      const copy = copyFor(id, {
        month: 0, year: 2026, amount: 10, months: 3, fromName: "א", company: "ב",
        balance: 1, couponId: 1, saved: 5, threshold: 1000, count: 10, remaining: 5,
      });
      // The sign never reaches a notification, whichever kind it is.
      expect(`${copy.title} ${copy.body}`).not.toContain("₪");
      expect(copy.title).toMatch(/[֐-׿]/);
      expect(copy.body).toMatch(/[֐-׿]/);
    }
  });
});
