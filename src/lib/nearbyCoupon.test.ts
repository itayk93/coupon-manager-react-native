import { describe, expect, it } from "vitest";
import {
  distanceMeters,
  nearbyCoupon,
  nearbyCouponIsland,
  type NearbyCandidate,
  type NearbyPlace,
} from "./nearbyCoupon";

const here = { latitude: 32.0853, longitude: 34.7818 };
const today = "2026-09-24";

const coupon = (id: number, overrides: Partial<NearbyCandidate> = {}): NearbyCandidate => ({
  id,
  public_id: `c${id}`,
  company: "גוד פארם",
  value: 100,
  used_value: 0,
  status: "פעיל",
  expiration: "2026-12-31",
  ...overrides,
});

const place = (id: string, metersNorth: number, couponIds: number[]): NearbyPlace => ({
  id,
  name: `סניף ${id}`,
  latitude: here.latitude + metersNorth / 111_320,
  longitude: here.longitude,
  transactions: couponIds.map((couponId) => ({ couponId })),
});

describe("distanceMeters", () => {
  it("measures street-scale distances", () => {
    expect(Math.round(distanceMeters(here, place("a", 200, []))) ).toBe(200);
  });
});

describe("nearbyCoupon", () => {
  it("offers the company's live coupon at a place where an older one was spent", () => {
    const finished = coupon(1, { status: "נוצל", used_value: 100 });
    const live = coupon(2, { company: "GoodPharm ", value: 80 }); // same company, other spelling
    const match = nearbyCoupon(here, [place("a", 120, [1])], [finished, live], today);
    expect(match?.coupon.id).toBe(2);
    expect(match?.remaining).toBe(80);
  });

  it("stays quiet beyond the radius, or when nothing there has money left", () => {
    expect(nearbyCoupon(here, [place("a", 400, [1])], [coupon(1)], today)).toBeNull();
    expect(nearbyCoupon(here, [place("a", 50, [1])], [coupon(1, { used_value: 100 })], today)).toBeNull();
    expect(nearbyCoupon(here, [place("a", 50, [1])], [coupon(1, { expiration: "2026-09-01" })], today)).toBeNull();
  });

  it("takes the nearest place, then the coupon with the most left", () => {
    const coupons = [
      coupon(1, { company: "Wolt", value: 50 }),
      coupon(2, { value: 30 }),
      coupon(3, { value: 90 }),
    ];
    const match = nearbyCoupon(here, [place("far", 200, [1]), place("near", 40, [2])], coupons, today);
    expect(match?.place.id).toBe("near");
    expect(match?.coupon.id).toBe(3);
  });
});

describe("nearbyCouponIsland", () => {
  it("names the place and the money waiting there", () => {
    const match = nearbyCoupon(here, [place("a", 50, [1])], [coupon(1)], today)!;
    expect(nearbyCouponIsland(match)).toEqual({
      title: "סניף a ממש קרוב",
      message: "יש לך קופון גוד פארם עם ⁦₪ 100⁩",
    });
  });
});
