/**
 * Distance between two lat/lng points, and the "places near an area" filter
 * built on it. Kept as a pure module so the radius logic is tested without a
 * map — the place picker only renders what this returns.
 */

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The places within `radiusKm` of `center`, nearest first. A missing centre
 * (no area typed yet) returns nothing — the picker shows its prompt instead of
 * dropping every pin in the country on the map.
 */
export function filterPlacesWithinRadius<T extends GeoPoint>(
  places: T[],
  center: GeoPoint | null,
  radiusKm: number,
): Array<T & { distanceKm: number }> {
  if (!center) return [];
  return places
    .map((place) => ({ ...place, distanceKm: distanceKm(center, place) }))
    .filter((place) => place.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
