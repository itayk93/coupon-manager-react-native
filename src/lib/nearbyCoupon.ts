import { companyKey } from "@/lib/companyName";
import { formatIls, formatIlsCompact } from "@/lib/formatIls";
import type { IslandCopy } from "@/lib/islandCopy";

/** Close enough to walk in: a shop front, not the neighbourhood. */
export const NEARBY_RADIUS_METERS = 250;

export type Point = { latitude: number; longitude: number };

export type NearbyPlace = Point & {
  id: string;
  name: string;
  /** Coupons that were spent here before, which is how a place gets a company. */
  transactions: Array<{ couponId: number }>;
};

export type NearbyCandidate = {
  id: number;
  public_id: string;
  company: string;
  value: number | null;
  used_value: number | null;
  status: string | null;
  expiration: string | null;
};

export type NearbyMatch = {
  place: NearbyPlace;
  coupon: NearbyCandidate;
  remaining: number;
  meters: number;
};

/** Great-circle distance in metres; plenty accurate at street scale. */
export function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function remainingFor(coupon: NearbyCandidate): number {
  return Math.max(0, (coupon.value ?? 0) - (coupon.used_value ?? 0));
}

function isUsableToday(coupon: NearbyCandidate, today: string): boolean {
  return coupon.status !== "נוצל" && remainingFor(coupon) > 0 && (!coupon.expiration || coupon.expiration.slice(0, 10) >= today);
}

/**
 * A coupon worth remembering right here, if there is one.
 *
 * The places are the ones the user has already spent coupons at, so a place
 * knows which companies it takes. The coupon offered is one of that company's
 * that still has money on it — often not the one used there last time, which
 * may be long finished. Nearest place first; at a place, the most money left.
 */
export function nearbyCoupon(
  here: Point,
  places: NearbyPlace[],
  coupons: NearbyCandidate[],
  today: string,
  radius = NEARBY_RADIUS_METERS,
): NearbyMatch | null {
  const companyOf = new Map(coupons.map((coupon) => [coupon.id, companyKey(coupon.company)]));
  const usable = coupons.filter((coupon) => isUsableToday(coupon, today));

  const near = places
    .map((place) => ({ place, meters: distanceMeters(here, place) }))
    .filter((item) => item.meters <= radius)
    .sort((a, b) => a.meters - b.meters);

  for (const { place, meters } of near) {
    const companies = new Set(
      place.transactions.map((t) => companyOf.get(t.couponId)).filter((key): key is string => Boolean(key)),
    );
    const best = usable
      .filter((coupon) => companies.has(companyKey(coupon.company)))
      .sort((a, b) => remainingFor(b) - remainingFor(a))[0];
    if (best) return { place, coupon: best, remaining: remainingFor(best), meters };
  }
  return null;
}

export function nearbyCouponIsland(match: NearbyMatch): IslandCopy {
  const amount = Number.isInteger(match.remaining) ? formatIlsCompact(match.remaining) : formatIls(match.remaining);
  return {
    title: `${match.place.name} ממש קרוב`,
    message: `יש לך קופון ${match.coupon.company.trim()} עם ${amount}`,
  };
}
