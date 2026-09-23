import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expiryFaceKey } from "./expiryFaceKey";
import {
  expiryIconKey,
  iconKeyFor,
  notificationIconUrl,
} from "../../supabase/functions/_shared/notificationIcons";

/**
 * A push that names an icon the PWA cannot serve shows a broken banner, so
 * every face the server hands out must exist on disk, at the size the browser
 * gets and as the master the iOS extension will be built from.
 */

describe("notification faces", () => {
  it("escalates expiry on the widget's ladder", () => {
    expect([0, 1, 2, 3, 4, 7, 14].map(expiryIconKey)).toEqual([
      "expiry-today",
      "expiry-tomorrow",
      "expiry-soon",
      "expiry-soon",
      "expiry-week",
      "expiry-week",
      "expiry-week",
    ]);
  });

  it("puts the same face on a local reminder as on the push", () => {
    for (const days of [0, 1, 2, 3, 4, 7, 30]) {
      expect(expiryFaceKey(days)).toBe(expiryIconKey(days));
    }
  });

  it("maps every other kind to its own face", () => {
    expect(iconKeyFor("idle_money")).toBe("idle-money");
    expect(iconKeyFor("expiry", 5)).toBe("expiry-week");
  });

  it("falls back to the default face, not the app icon", () => {
    expect(notificationIconUrl("default")).toBe("/notification-icons/default.png?v=1");
  });

  it("serves only faces that exist", () => {
    const keys = [
      ...[0, 1, 2, 5].map(expiryIconKey),
      ...(["monthly_summary", "idle_money", "share_received", "balance_updated",
        "coupon_finished", "coupon_milestone", "expired_unused"] as const).map((t) => iconKeyFor(t)),
      "default" as const,
    ];
    for (const key of keys) {
      const url = notificationIconUrl(key);
      if (!url) continue;
      const file = `public${url.split("?")[0]}`;
      expect(existsSync(file), file).toBe(true);
      expect(existsSync(`assets/notification-icons/${key}.png`), key).toBe(true);
      const png = readFileSync(file);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([256, 256]);
    }
    expect(notificationIconUrl("expiry-week")).toBe("/notification-icons/expiry-week.png?v=1");
  });
});
