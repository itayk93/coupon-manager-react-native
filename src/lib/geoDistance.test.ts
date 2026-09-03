import { describe, expect, it } from "vitest";
import { distanceKm, filterPlacesWithinRadius } from "./geoDistance";

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const JERUSALEM = { latitude: 31.7683, longitude: 35.2137 };

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(TEL_AVIV, TEL_AVIV)).toBe(0);
  });

  it("matches the known Tel Aviv–Jerusalem distance (~54 km)", () => {
    expect(distanceKm(TEL_AVIV, JERUSALEM)).toBeGreaterThan(52);
    expect(distanceKm(TEL_AVIV, JERUSALEM)).toBeLessThan(56);
  });

  it("is symmetric", () => {
    expect(distanceKm(TEL_AVIV, JERUSALEM)).toBeCloseTo(distanceKm(JERUSALEM, TEL_AVIV), 6);
  });
});

describe("filterPlacesWithinRadius", () => {
  const places = [
    { id: "close", latitude: 32.0866, longitude: 34.7825 }, // ~150 m from center
    { id: "mid", latitude: 32.11, longitude: 34.79 }, // ~2.8 km
    { id: "far", ...JERUSALEM },
  ];

  it("returns nothing without a center", () => {
    expect(filterPlacesWithinRadius(places, null, 3)).toEqual([]);
  });

  it("keeps only places inside the radius", () => {
    const result = filterPlacesWithinRadius(places, TEL_AVIV, 3);
    expect(result.map((p) => p.id)).toEqual(["close", "mid"]);
  });

  it("orders results nearest first and attaches the distance", () => {
    const result = filterPlacesWithinRadius(places, TEL_AVIV, 100);
    expect(result.map((p) => p.id)).toEqual(["close", "mid", "far"]);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
  });
});
