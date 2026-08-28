/**
 * Choosing the places to watch, and deciding whether to speak.
 *
 * Split out of nearbyAlerts.ts, which registers a background task the moment it
 * is imported and reaches for three native modules. These two decisions are the
 * ones with real judgement in them — which twenty places out of a history, and
 * whether the person walking past wants to hear it — so they live where a test
 * can reach them.
 */

/** Close enough to act on, far enough to fire before the door. */
export const RADIUS_METERS = 150;
/** iOS will not watch more than 20 regions per app. */
export const MAX_REGIONS = 20;
/** Below this, being reminded is more annoying than useful. */
export const MIN_REMAINING = 20;
/** One reminder per place per week, however often you walk past. */
export const REPEAT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Nobody wants a coupon reminder at two in the morning. */
export const QUIET_BEFORE_HOUR = 9;
export const QUIET_AFTER_HOUR = 22;

export type NearbyTarget = {
  id: string;
  company: string;
  couponId: number;
  couponPublicId?: string | null;
  remaining: number;
  latitude: number;
  longitude: number;
  /** Pre-written lines, so nothing has to be generated at the doorstep. */
  variants: Array<{ title: string; body: string }>;
  phrasedAt: number;
};

export type NearbyPlace = {
  name: string;
  latitude: number;
  longitude: number;
};

export type NearbyCoupon = {
  id: number;
  public_id?: string | null;
  company: string;
  value: number | null;
  used_value: number | null;
  status: string | null;
};

/** Same normalisation the purchase map uses, so the two agree on a name. */
function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("he-IL")
    .replace(/["'׳״.,()\-]/g, " ")
    .replace(/\s+/g, " ");
}

function remainingOf(coupon: NearbyCoupon): number {
  return Math.max(0, (coupon.value || 0) - (coupon.used_value || 0));
}

/**
 * Which places are worth watching.
 *
 * A place earns a geofence by matching, by name, a coupon that still has money
 * on it. That is the whole join: the purchase map knows where you have been,
 * the wallet knows where you have money, and the company name is what connects
 * them.
 */
export function buildTargets(coupons: NearbyCoupon[], places: NearbyPlace[]): NearbyTarget[] {
  const byCompany = new Map<string, NearbyCoupon>();
  for (const coupon of coupons) {
    if (coupon.status === "נוצל") continue;
    const remaining = remainingOf(coupon);
    if (remaining < MIN_REMAINING) continue;
    const key = normalize(coupon.company || "");
    if (!key) continue;
    // Several coupons for one shop: the fattest one speaks for the rest.
    const existing = byCompany.get(key);
    if (!existing || remainingOf(existing) < remaining) byCompany.set(key, coupon);
  }

  const targets: NearbyTarget[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    const key = normalize(place.name || "");
    const coupon = byCompany.get(key);
    if (!coupon) continue;
    // One region per physical place, not per coupon.
    const id = `${key}:${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    targets.push({
      id,
      company: coupon.company,
      couponId: coupon.id,
      couponPublicId: coupon.public_id,
      remaining: remainingOf(coupon),
      latitude: place.latitude,
      longitude: place.longitude,
      variants: [],
      phrasedAt: 0,
    });
  }

  // Under the OS cap, the richest coupons win: if only twenty places can be
  // watched, watch the twenty holding the most money.
  return targets.sort((a, b) => b.remaining - a.remaining).slice(0, MAX_REGIONS);
}

/**
 * Whether this place may be mentioned right now.
 *
 * Two rules, and both exist because of the same person: the one who works next
 * door to a shop they have a coupon for.
 */
export function mayAlert(lastAlertAt: number | undefined, now: Date): boolean {
  const hour = now.getHours();
  if (hour < QUIET_BEFORE_HOUR || hour >= QUIET_AFTER_HOUR) return false;
  if (lastAlertAt && now.getTime() - lastAlertAt < REPEAT_COOLDOWN_MS) return false;
  return true;
}
