/**
 * Judging how well a lookup identified a place, so only real answers get kept.
 *
 * Every lookup here is a shop name, often with a street and a city after it.
 * Two different Google APIs answer it, and they fail in different ways:
 *
 * - Places Text Search knows businesses. When it finds one it hands back a
 *   `place_id`, a display name and a pin — that is the answer we want.
 * - The Geocoding API knows street addresses. Fed a shop name it does not
 *   recognise, it does not give up: it drops the words it cannot parse and
 *   answers with whatever the rest resolves to, flagged `partial_match`. For
 *   "גוד פארם יהודה הלוי תל אביב" that was "המלך ג'ורג' 25" — a plausible
 *   street-level pin three blocks from the real branch, which then got cached
 *   and served on every later lookup of the same name. For a name that means
 *   nothing at all it answers with the centroid of the country.
 *
 * `geocodeConfidence` reads Google's own signals — `partial_match`, the result
 * `types`, the address components — and says whether a geocoding result pins a
 * building or merely gestures at an area. `isCountryLevelResult` catches the
 * degenerate country-centroid answer from any API.
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

/**
 * How much to trust a Geocoding API result.
 *
 * `strong` — Google matched the whole query and the result pins one building:
 *   a business, a premise, or a street address with a house number. Worth
 *   caching and serving again.
 * `weak` — Google admits a `partial_match`, or the best it found is a street,
 *   a neighbourhood or a city. Better than nothing for one screen, but not an
 *   answer to remember.
 */
export type GeocodeConfidence = "strong" | "weak";

/** Result types Google gives a business or a single building. */
const PINPOINT_RESULT_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "premise",
  "subpremise",
  "street_address",
]);

/** Address components that only exist once the result is down to a building. */
const PINPOINT_COMPONENT_TYPES = new Set(["street_number", "premise", "subpremise"]);

export type GeocodingApiResult = {
  partial_match?: boolean | null;
  types?: string[] | null;
  address_components?: Array<{ types?: string[] | null }> | null;
};

export function geocodeConfidence(result: GeocodingApiResult): GeocodeConfidence {
  if (result.partial_match) return "weak";

  const types = result.types ?? [];
  if (types.some((type) => PINPOINT_RESULT_TYPES.has(type))) return "strong";

  const components = result.address_components ?? [];
  const pinned = components.some((component) =>
    (component.types ?? []).some((type) => PINPOINT_COMPONENT_TYPES.has(type))
  );
  return pinned ? "strong" : "weak";
}

/**
 * Whether a place Google returned is plausibly the one the query asked for.
 *
 * Places Text Search never says "no": asked for a name it does not know it
 * still returns the closest business it can think of. Requiring at least one
 * meaningful word of the query to appear in the returned name or address
 * keeps that guess from being cached under the wrong name. Punctuation and
 * one-letter tokens are ignored; so is the country, which every query carries.
 */
const IGNORED_QUERY_TOKENS = new Set(["ישראל", "israel", "il"]);

export function placeMatchesQuery(query: string, candidateTexts: Array<string | null | undefined>): boolean {
  const haystack = normalizeForMatch(candidateTexts.filter(Boolean).join(" "));
  if (!haystack) return false;
  const tokens = normalizeForMatch(query)
    .split(" ")
    .filter((token) => token.length >= 2 && !IGNORED_QUERY_TOKENS.has(token));
  if (tokens.length === 0) return false;
  return tokens.some((token) => haystack.includes(token));
}

function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase("he-IL")
    .replace(/["'׳״.,()\-–—/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
