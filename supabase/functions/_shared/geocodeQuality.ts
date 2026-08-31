/**
 * Rejecting a geocoding result that is not actually a place.
 *
 * Every lookup here is a shop name with `, ישראל` appended. When the name means
 * nothing to Google — an online store like "אתר מפעל הפיס", or a typo such as
 * "ארקפה - מיזטאון" — the geocoder falls back to the only part it recognised
 * and answers with the centroid of the country: 31.046051, 34.851612, formatted
 * address "ישראל". That is not a wrong pin, it is a pin for a coupon that was
 * never used anywhere in particular, and it dragged the whole usage map out to
 * the Negev to fit it in.
 *
 * Seventeen cached places and seven usage rows carried that centroid before
 * this check existed.
 */

/** Google's own centroid for Israel, to a tolerance wider than any rounding. */
const COUNTRY_CENTROID = { latitude: 31.046051, longitude: 34.851612 };
const CENTROID_TOLERANCE_DEG = 0.02;

/** Result types that describe a region rather than somewhere you can stand. */
const AREA_TYPES = new Set([
  "country",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "political",
]);

const COUNTRY_ADDRESSES = new Set(["ישראל", "israel", "il"]);

export type GeocodeCandidate = {
  latitude: number;
  longitude: number;
  address?: string | null;
  /** `types` from the Geocoding API, when the caller has them. */
  types?: string[] | null;
};

export function isCountryLevelResult(candidate: GeocodeCandidate): boolean {
  const { latitude, longitude, address, types } = candidate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return true;

  if (
    Math.abs(latitude - COUNTRY_CENTROID.latitude) < CENTROID_TOLERANCE_DEG &&
    Math.abs(longitude - COUNTRY_CENTROID.longitude) < CENTROID_TOLERANCE_DEG
  ) {
    return true;
  }

  const normalizedAddress = (address || "").trim().toLocaleLowerCase("he-IL");
  if (COUNTRY_ADDRESSES.has(normalizedAddress)) return true;

  // `political` alone is not enough — a real street address carries it too —
  // so only a result whose types are *all* area-level counts as one.
  if (types && types.length > 0 && types.every((type) => AREA_TYPES.has(type))) return true;

  return false;
}
