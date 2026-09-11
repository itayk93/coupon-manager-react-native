import { describe, expect, it } from "vitest";
import {
  daysUntilExpiry,
  expiringSoon,
  homeHeroSummary,
  topCouponTags,
} from "./homeHero";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

const NOW = new Date(2026, 8, 11, 9, 30);

/** Local noon on the day `days` from NOW, so the fixture is read as that date
 *  in whatever timezone the test runs in. */
function inDays(days: number): string {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, 12).toISOString();
}

function coupon(overrides: Partial<DecryptedCoupon>): DecryptedCoupon {
  return {
    id: 1,
    company: "BuyMe",
    value: 100,
    used_value: 0,
    status: "פעיל",
    expiration: null,
    ...overrides,
  } as DecryptedCoupon;
}

describe("daysUntilExpiry", () => {
  it("counts calendar days, so tonight is today and not a fraction", () => {
    expect(daysUntilExpiry(new Date(2026, 8, 11, 23, 59).toISOString(), NOW)).toBe(0);
    expect(daysUntilExpiry(inDays(1), NOW)).toBe(1);
    expect(daysUntilExpiry(inDays(14), NOW)).toBe(14);
    expect(daysUntilExpiry(inDays(-2), NOW)).toBe(-2);
  });

  it("has nothing to say about a missing or unparsable date", () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull();
    expect(daysUntilExpiry(undefined, NOW)).toBeNull();
    expect(daysUntilExpiry("not a date", NOW)).toBeNull();
  });
});

describe("expiringSoon", () => {
  it("orders by urgency, and by money left when two share a day", () => {
    const list = expiringSoon(
      [
        coupon({ id: 1, expiration: inDays(9) }),
        coupon({ id: 2, expiration: inDays(2), value: 50 }),
        coupon({ id: 3, expiration: inDays(2), value: 300, used_value: 40 }),
        coupon({ id: 4, expiration: inDays(0) }),
      ],
      NOW
    );
    expect(list.map((entry) => entry.coupon.id)).toEqual([4, 3, 2, 1]);
    expect(list.map((entry) => entry.days)).toEqual([0, 2, 2, 9]);
  });

  it("leaves out spent, expired and far-off coupons", () => {
    const list = expiringSoon(
      [
        coupon({ id: 1, expiration: inDays(3), status: "נוצל" }),
        coupon({ id: 2, expiration: inDays(-1) }),
        coupon({ id: 3, expiration: inDays(15) }),
        coupon({ id: 4, expiration: null }),
        coupon({ id: 5, expiration: inDays(14) }),
      ],
      NOW
    );
    expect(list.map((entry) => entry.coupon.id)).toEqual([5]);
  });
});

describe("homeHeroSummary", () => {
  it("asks for the first coupon when the wallet is empty", () => {
    const summary = homeHeroSummary([coupon({ status: "נוצל" })], NOW);
    expect(summary.state).toBe("empty");
    expect(summary.message).toBe("בוא נוסיף את הקופון הראשון שלך");
    expect(summary.linksToExpiring).toBe(false);
  });

  it("panics about a single coupon expiring today, in the singular", () => {
    const summary = homeHeroSummary([coupon({ expiration: inDays(0) })], NOW);
    expect(summary.state).toBe("panic");
    expect(summary.message).toBe("קופון אחד צריך אותך היום!");
    expect(summary.urgentCount).toBe(1);
    expect(summary.linksToExpiring).toBe(true);
  });

  it("counts the coupons that have to be rescued today", () => {
    const summary = homeHeroSummary(
      [
        coupon({ id: 1, expiration: inDays(0) }),
        coupon({ id: 2, expiration: inDays(0) }),
        coupon({ id: 3, expiration: inDays(0) }),
        coupon({ id: 4, expiration: inDays(5) }),
      ],
      NOW
    );
    expect(summary.message).toBe("יש לך 3 קופונים שצריך להציל היום!");
    expect(summary.urgentCount).toBe(3);
    expect(summary.nearestDays).toBe(0);
  });

  it("moves to the week's wording once nothing expires today", () => {
    const summary = homeHeroSummary(
      [coupon({ id: 1, expiration: inDays(3) }), coupon({ id: 2, expiration: inDays(7) })],
      NOW
    );
    expect(summary.state).toBe("concerned");
    expect(summary.message).toBe("יש לך 2 קופונים שכדאי לנצל השבוע!");
  });

  it("still panics on tomorrow, even under the week's headline", () => {
    const summary = homeHeroSummary([coupon({ expiration: inDays(1) })], NOW);
    expect(summary.state).toBe("panic");
    expect(summary.message).toBe("יש לך קופון אחד שכדאי לנצל השבוע!");
  });

  it("only nudges for the second week", () => {
    const summary = homeHeroSummary([coupon({ expiration: inDays(12) })], NOW);
    expect(summary.state).toBe("happy");
    expect(summary.message).toBe("יש משהו שכדאי לשים עליו עין 👀");
    expect(summary.linksToExpiring).toBe(true);
  });

  it("says the wallet is calm when nothing is close", () => {
    const summary = homeHeroSummary(
      [coupon({ id: 1, expiration: inDays(40) }), coupon({ id: 2, expiration: null })],
      NOW
    );
    expect(summary.state).toBe("happy");
    expect(summary.message).toBe("הכול רגוע. הקופונים שלך מסודרים ✨");
    expect(summary.nearestDays).toBeNull();
    expect(summary.linksToExpiring).toBe(false);
  });

  it("ignores coupons that already expired rather than shouting about them", () => {
    const summary = homeHeroSummary([coupon({ expiration: inDays(-3) })], NOW);
    expect(summary.state).toBe("happy");
    expect(summary.message).toBe("הכול רגוע. הקופונים שלך מסודרים ✨");
  });
});

describe("topCouponTags", () => {
  it("ranks the user's real tags by how many coupons carry them", () => {
    const coupons = [coupon({ id: 1 }), coupon({ id: 2 }), coupon({ id: 3 })];
    const tags = topCouponTags(coupons, { 1: ["אוכל", "מתנה"], 2: ["אוכל"], 3: ["אופנה"] });
    expect(tags).toEqual(["אוכל", "אופנה", "מתנה"]);
  });

  it("never counts a spent coupon, and never invents a tag", () => {
    const coupons = [coupon({ id: 1, status: "נוצל" }), coupon({ id: 2 })];
    expect(topCouponTags(coupons, { 1: ["אוכל"], 2: ["  "] })).toEqual([]);
  });

  it("keeps the row short", () => {
    const coupons = [coupon({ id: 1 })];
    const tags = topCouponTags(coupons, { 1: ["א", "ב", "ג", "ד", "ה"] }, 4);
    expect(tags).toHaveLength(4);
  });
});
