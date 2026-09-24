import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_FACE_KEYS, faceKeyForNotification, routeForNotification } from "./notificationRoute";

describe("routeForNotification", () => {
  it("follows the in-app path a server push carries", () => {
    expect(routeForNotification({ url: "/coupons/abc123", iconKey: "balance-updated" })).toBe("/coupons/abc123");
    expect(routeForNotification({ url: "/coupons?ids=a,b" })).toBe("/coupons?ids=a,b");
  });

  it("refuses anything that would leave the app", () => {
    expect(routeForNotification({ url: "https://evil.example/coupons" })).toBeNull();
    expect(routeForNotification({ url: "//evil.example" })).toBeNull();
    expect(routeForNotification({ url: "javascript:alert(1)" })).toBeNull();
  });

  it("opens the coupon a local reminder is about, or the list for a digest", () => {
    expect(routeForNotification({ kind: "expiry", couponId: 42 })).toBe("/coupons/42");
    expect(routeForNotification({ kind: "expiry", couponIds: [1, 2] })).toBe("/coupons");
  });

  it("ignores data it does not recognise", () => {
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification({})).toBeNull();
    expect(routeForNotification("/coupons")).toBeNull();
  });
});

describe("faceKeyForNotification", () => {
  it("uses the face the push named, and the default otherwise", () => {
    expect(faceKeyForNotification({ iconKey: "expiry-today" })).toBe("expiry-today");
    expect(faceKeyForNotification({ iconKey: "not-a-face" })).toBe("default");
    expect(faceKeyForNotification(undefined)).toBe("default");
  });

  it("names only faces that exist as drawings", () => {
    const drawn = readdirSync("public/notification-icons").map((file) => file.replace(/\.png$/, ""));
    for (const key of NOTIFICATION_FACE_KEYS) expect(drawn).toContain(key);
  });
});
