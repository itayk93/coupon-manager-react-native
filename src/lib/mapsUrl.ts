/**
 * A link that opens a coordinate in whatever map app the person actually uses.
 *
 * The universal Google Maps URL is the one worth building: on a phone it hands
 * off to the installed Maps app, and everywhere else it opens the web map. An
 * `Apple Maps`-specific `maps://` link would be shorter and would strand every
 * Android user and every browser.
 */
export function mapsSearchUrl(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
