import { describe, expect, it } from "vitest";
import { MAX_REGIONS, buildTargets, mayAlert } from "./nearbyTargets";

const place = (name: string, lat = 32.07, lng = 34.78) => ({
  name, latitude: lat, longitude: lng,
});

const coupon = (id: number, company: string, value: number, used = 0) => ({
  id, company, value, used_value: used, status: "פעיל",
});

describe("buildTargets", () => {
  it("watches a place only where there is still money for it", () => {
    const targets = buildTargets(
      [coupon(1, "רולדין", 60), coupon(2, "קסטרו", 80, 80)],
      [place("רולדין"), place("קסטרו", 32.08, 34.79)],
    );
    expect(targets.map((target) => target.company)).toEqual(["רולדין"]);
    expect(targets[0].remaining).toBe(60);
  });

  it("matches a name however it was punctuated or capitalised", () => {
    // The purchase map and the wallet do not agree on quotes and spacing;
    // "גוד פארם" and "גוד-פארם" are the same shop to a person.
    const targets = buildTargets([coupon(1, "גוד פארם", 50)], [place("גוד-פארם")]);
    expect(targets).toHaveLength(1);
  });

  it("ignores a balance too small to be worth interrupting someone for", () => {
    expect(buildTargets([coupon(1, "רולדין", 12)], [place("רולדין")])).toHaveLength(0);
  });

  it("ignores a spent coupon even when the status was never updated", () => {
    expect(buildTargets([coupon(1, "רולדין", 60, 60)], [place("רולדין")])).toHaveLength(0);
  });

  it("keeps one region per physical place, not per coupon", () => {
    const targets = buildTargets(
      [coupon(1, "רולדין", 40), coupon(2, "רולדין", 90)],
      [place("רולדין")],
    );
    expect(targets).toHaveLength(1);
    // The larger balance is the one worth naming.
    expect(targets[0].remaining).toBe(90);
  });

  it("keeps the richest places when there are more than the OS will watch", () => {
    const coupons = Array.from({ length: 30 }, (_, index) =>
      coupon(index, `חנות${index}`, 25 + index));
    const places = Array.from({ length: 30 }, (_, index) =>
      place(`חנות${index}`, 32 + index / 1000, 34 + index / 1000));

    const targets = buildTargets(coupons, places);
    expect(targets).toHaveLength(MAX_REGIONS);
    // iOS silently drops regions past its cap, so the choice of which to keep
    // has to be ours: the most money first.
    expect(targets[0].remaining).toBe(54);
    expect(Math.min(...targets.map((target) => target.remaining))).toBe(35);
  });

  it("ignores a place nobody holds a coupon for", () => {
    expect(buildTargets([coupon(1, "רולדין", 60)], [place("ארומה")])).toHaveLength(0);
  });
});

describe("mayAlert", () => {
  const at = (hour: number) => new Date(2026, 7, 27, hour, 0, 0);

  it("speaks during the day", () => {
    expect(mayAlert(undefined, at(13))).toBe(true);
  });

  it("stays quiet at night", () => {
    expect(mayAlert(undefined, at(2))).toBe(false);
    expect(mayAlert(undefined, at(23))).toBe(false);
    expect(mayAlert(undefined, at(8))).toBe(false);
  });

  it("does not repeat itself for a week", () => {
    // The person this rule exists for works next door to the shop.
    const yesterday = at(13).getTime() - 24 * 60 * 60 * 1000;
    expect(mayAlert(yesterday, at(13))).toBe(false);
  });

  it("speaks again once the week is up", () => {
    const longAgo = at(13).getTime() - 8 * 24 * 60 * 60 * 1000;
    expect(mayAlert(longAgo, at(13))).toBe(true);
  });
});
