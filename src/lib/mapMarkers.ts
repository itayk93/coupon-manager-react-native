/**
 * Turning a list of coupon usages into the pins and the frame a map should show.
 *
 * Kept out of the map component so it can be tested without a native map: the
 * arithmetic here is the part that was wrong, not the rendering.
 */

export type MapPoint = {
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  id?: string;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const ISRAEL_REGION: MapRegion = {
  latitude: 31.8,
  longitude: 34.9,
  latitudeDelta: 2.8,
  longitudeDelta: 2.8,
};

/** Roughly a kilometre across: the right frame for a single point. */
const SINGLE_POINT_DELTA = 0.01;

/**
 * One marker per place, not one per visit.
 *
 * Somebody who used a coupon at the same cafe five times has one dot on the
 * map, and the callout says five. Stacking five identical markers just draws
 * the same pin five times and reads as one.
 */
export function groupByPoint(points: MapPoint[]): Array<MapPoint & { visits: number }> {
  const groups = new Map<string, MapPoint & { visits: number }>();
  points.forEach((point) => {
    // Five decimals is about a metre. Beyond that two readings of the same
    // doorway differ, and rounding is what makes them one place again.
    const key = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.visits += 1;
      // Keep whichever entry actually named the place.
      if (!existing.title && point.title) existing.title = point.title;
      if (!existing.description && point.description) existing.description = point.description;
      return;
    }
    groups.set(key, { ...point, visits: 1 });
  });
  return [...groups.values()];
}

/**
 * The smallest frame that holds every point, with room to breathe.
 *
 * `fitToCoordinates` would do this after layout, but it animates from wherever
 * the map started, so the first thing on screen is still the wrong region.
 * Computing it up front means the map opens correct.
 */
export function regionForPoints(points: MapPoint[]): MapRegion {
  if (!points.length) return ISRAEL_REGION;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // 1.4 keeps the outermost pins off the edge, where the marker art would be
    // half cut. The floor covers points that coincide.
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, SINGLE_POINT_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, SINGLE_POINT_DELTA),
  };
}

