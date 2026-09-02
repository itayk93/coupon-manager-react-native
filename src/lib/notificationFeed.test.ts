import { describe, expect, it } from "vitest";
import { legacyHebrew, mergeNotificationFeeds } from "./notificationFeed";

describe("legacyHebrew", () => {
  it("translates the share-granted phrase", () => {
    expect(legacyHebrew("You now have access to Wolt coupon")).toBe(
      "קיבלת גישה לקופון של Wolt"
    );
  });

  it("drops the bidi marks a banner text was stored with", () => {
    expect(legacyHebrew("\u200Fהקופון ב\u2066Wolt\u2069 נסגר")).toBe("הקופון בWolt נסגר");
  });

  it("translates the share-revoked phrase", () => {
    expect(legacyHebrew("Access to Wolt coupon was revoked")).toBe(
      "הגישה לקופון של Wolt בוטלה"
    );
  });

  it("translates the accepted-share phrase", () => {
    expect(legacyHebrew("Noa accepted your shared coupon")).toBe(
      "Noa אישר/ה את הקופון ששיתפת"
    );
  });

  it("leaves already-Hebrew text alone", () => {
    expect(legacyHebrew("עדכון בארנק")).toBe("עדכון בארנק");
  });
});

describe("mergeNotificationFeeds", () => {
  it("drops a duplicate with identical kind, title and message", () => {
    const a = { id: "1", kind: "share_received", title: "שיתוף", message: "נועה שיתפה" };
    const b = { id: "2", kind: "share_received", title: "שיתוף", message: "נועה שיתפה" };
    expect(mergeNotificationFeeds([[a, b]])).toHaveLength(1);
  });

  it("keeps two rows that differ only in message", () => {
    const a = { id: "1", kind: "expiry", title: "תפוגה", message: "נותרו 2 ימים" };
    const b = { id: "2", kind: "expiry", title: "תפוגה", message: "נותרו 5 ימים" };
    expect(mergeNotificationFeeds([[a, b]])).toHaveLength(2);
  });

  it("flattens and merges across multiple feeds", () => {
    const live = [{ id: "live", kind: "share_received", title: "שיתוף", message: "נועה שיתפה" }];
    const stored = [{ id: "stored", kind: "share_received", title: "שיתוף", message: "נועה שיתפה" }];
    expect(mergeNotificationFeeds([live, stored])).toHaveLength(1);
  });
});
